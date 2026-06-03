const META_TOKEN = process.env.META_ACCESS_TOKEN
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY
const API_VERSION = 'v19.0'

async function metaGet(path, params) {
  var qs = Object.assign({ access_token: META_TOKEN, limit: 500 }, params || {})
  var url = 'https://graph.facebook.com/' + API_VERSION + path + '?' +
    Object.keys(qs).map(function(k) { return k + '=' + encodeURIComponent(qs[k]) }).join('&')
  var res = await fetch(url)
  var json = await res.json()
  if (json.error) throw new Error('Meta API: ' + json.error.message)
  return json
}

async function sbPost(table, body) {
  var url = SUPABASE_URL + '/rest/v1/' + table
  var res = await fetch(url, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates'
    },
    body: JSON.stringify(body)
  })
  return res.ok
}

async function sbGet(table, query) {
  var url = SUPABASE_URL + '/rest/v1/' + table + (query || '')
  var res = await fetch(url, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY
    }
  })
  return res.json()
}

// Busca cotacao USD->BRL do dia
async function getUsdToBrl() {
  try {
    var res = await fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL')
    var json = await res.json()
    var rate = parseFloat(json.USDBRL.bid)
    return isNaN(rate) ? 5.80 : rate
  } catch(e) {
    return 5.80 // fallback
  }
}

function extractAction(actions, type) {
  if (!actions) return 0
  var a = actions.find(function(x) { return x.action_type === type })
  return a ? parseFloat(a.value || 0) : 0
}

exports.handler = async (event) => {
  var headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  }

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' }

  try {
    if (!META_TOKEN) throw new Error('META_ACCESS_TOKEN nao configurado no Netlify')

    var body = {}
    try { body = JSON.parse(event.body || '{}') } catch(e) {}

    var days = parseInt(body.days || 7)
    var now = new Date()
    var today = now.toISOString().split('T')[0]
    var dateStart = days <= 1 ? today : new Date(now.getTime() - (days - 1) * 86400000).toISOString().split('T')[0]
    var dateEnd = today
    var timeRange = JSON.stringify({ since: dateStart, until: dateEnd })

    // Busca cotacao do dia
    var usdToBrl = await getUsdToBrl()

    // Busca contas cadastradas
    var accounts = await sbGet('meta_accounts', '?ativo=eq.true')
    if (!Array.isArray(accounts) || accounts.length === 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: 'Nenhuma conta cadastrada. Adicione em Inteligencia > Gerenciar Contas.' })
      }
    }

    var totalSynced = 0
    var errors = []

    for (var ai = 0; ai < accounts.length; ai++) {
      var account = accounts[ai]
      var actId = account.account_id

      try {
        // Busca info da conta para saber a moeda
        var accountInfo = await metaGet('/' + actId, { fields: 'currency' })
        var currency = accountInfo.currency || 'USD'
        // Fator de conversao: se USD converte pra BRL, se BRL mantem
        var fxRate = currency === 'USD' ? usdToBrl : 1.0

        // Dados diarios da conta
        var insights = await metaGet('/' + actId + '/insights', {
          fields: 'spend,impressions,clicks,actions,cpm,cpc,ctr,cpp',
          time_range: timeRange,
          time_increment: 1,
          level: 'account'
        })

        var rows = insights.data || []
        for (var ri = 0; ri < rows.length; ri++) {
          var row = rows[ri]
          // Delete existing record for this day+account before inserting
          await fetch(SUPABASE_URL + '/rest/v1/meta_ads_daily?data=eq.' + row.date_start + '&account_id=eq.' + actId, {
            method: 'DELETE',
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY }
          })
          var msgs = extractAction(row.actions, 'onsite_conversion.messaging_conversation_started_7d')
          var purchases = extractAction(row.actions, 'purchase')
          var spendBrl = parseFloat(row.spend || 0) * fxRate
          await sbPost('meta_ads_daily', {
            data: row.date_start,
            account_id: actId,
            account_name: account.nome,
            spend: spendBrl,
            impressions: parseInt(row.impressions || 0),
            clicks: parseInt(row.clicks || 0),
            messages: Math.round(msgs),
            purchases: Math.round(purchases),
            cpm: parseFloat(row.cpm || 0) * fxRate,
            cpc: parseFloat(row.cpc || 0) * fxRate,
            ctr: parseFloat(row.ctr || 0),
            cpp: parseFloat(row.cpp || 0) * fxRate,
            currency: 'BRL'
          })
          totalSynced++
        }

        // Dados por criativo
        var adInsights = await metaGet('/' + actId + '/insights', {
          fields: 'ad_name,adset_name,campaign_name,ad_id,adset_id,campaign_id,spend,impressions,clicks,ctr,cpm,cpp,actions,cost_per_action_type',
          time_range: timeRange,
          time_increment: 1,
          level: 'ad',
          limit: 200
        })

        var adRows = adInsights.data || []
        for (var adi = 0; adi < adRows.length; adi++) {
          var ad = adRows[adi]
          // Delete existing record for this day+ad before inserting
          await fetch(SUPABASE_URL + '/rest/v1/meta_criativos?data=eq.' + ad.date_start + '&ad_id=eq.' + (ad.ad_id || ''), {
            method: 'DELETE',
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY }
          })
          var adMsgs = extractAction(ad.actions, 'onsite_conversion.messaging_conversation_started_7d')
          var adPurchases = extractAction(ad.actions, 'purchase')
          var cpaArr = ad.cost_per_action_type || []
          var costPerMsg = 0
          cpaArr.forEach(function(a) {
            if (a.action_type === 'onsite_conversion.messaging_conversation_started_7d') {
              costPerMsg = parseFloat(a.value || 0) * fxRate
            }
          })
          await sbPost('meta_criativos', {
            data: ad.date_start,
            account_id: actId,
            campaign_id: ad.campaign_id || '',
            campaign_name: ad.campaign_name || '',
            adset_id: ad.adset_id || '',
            adset_name: ad.adset_name || '',
            ad_id: ad.ad_id || '',
            ad_name: ad.ad_name || '',
            spend: parseFloat(ad.spend || 0) * fxRate,
            impressions: parseInt(ad.impressions || 0),
            clicks: parseInt(ad.clicks || 0),
            messages: Math.round(adMsgs),
            purchases: Math.round(adPurchases),
            ctr: parseFloat(ad.ctr || 0),
            cpm: parseFloat(ad.cpm || 0) * fxRate,
            cpp: parseFloat(ad.cpp || 0) * fxRate,
            cost_per_message: costPerMsg,
            currency: 'BRL'
          })
        }

      } catch(e) {
        errors.push(account.nome + ': ' + e.message)
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        synced: totalSynced,
        accounts: accounts.length,
        usdToBrl: usdToBrl,
        period: dateStart + ' ate ' + dateEnd,
        errors: errors.length > 0 ? errors : undefined
      })
    }

  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) }
  }
}
