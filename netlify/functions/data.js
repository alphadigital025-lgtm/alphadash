const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY

exports.handler = async (event) => {
  var headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  }

  // Debug: verificar se as variaveis estao chegando
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Variaveis de ambiente faltando',
        SUPABASE_URL: SUPABASE_URL ? 'OK' : 'VAZIO',
        SUPABASE_KEY: SUPABASE_KEY ? 'OK' : 'VAZIO'
      })
    }
  }

  try {
    var params = event.queryStringParameters || {}
    var days = parseInt(params.days || '7')
    var now = new Date()
    var today = now.toISOString().split('T')[0]
    var start = days <= 1 ? today : new Date(now.getTime() - (days - 1) * 86400000).toISOString().split('T')[0]
    var end = today

    async function sb(table, query) {
      var url = SUPABASE_URL + '/rest/v1/' + table + (query || '')
      var res = await fetch(url, {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': 'Bearer ' + SUPABASE_KEY,
          'Content-Type': 'application/json'
        }
      })
      if (!res.ok) {
        var txt = await res.text()
        throw new Error('Supabase error ' + res.status + ': ' + txt)
      }
      return res.json()
    }

    var results = await Promise.all([
      sb('transacoes', '?data=gte.' + start + '&data=lte.' + end + '&order=data.desc'),
      sb('vendedores', '?ativo=eq.true'),
      sb('meta_ads_daily', '?data=gte.' + start + '&data=lte.' + end),
      sb('meta_accounts', '?ativo=eq.true'),
      sb('meta_criativos', '?data=gte.' + start + '&data=lte.' + end + '&order=spend.desc&limit=50'),
      sb('despesas', '?data_pagamento=gte.' + start + '&data_pagamento=lte.' + end)
    ])

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        transacoes: results[0] || [],
        vendedores: results[1] || [],
        metaAds: results[2] || [],
        metaAccounts: results[3] || [],
        criativos: results[4] || [],
        despesas: results[5] || [],
        periodo: { start, end, days }
      })
    }
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    }
  }
}
