const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY

async function sb(table, query) {
  var url = SUPABASE_URL + '/rest/v1/' + table + (query || '')
  var res = await fetch(url, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Content-Type': 'application/json'
    }
  })
  var text = await res.text()
  try { return JSON.parse(text) } catch(e) { return [] }
}

exports.handler = async (event) => {
  var headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  }

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' }

  try {
    var params = event.queryStringParameters || {}
    var days = parseInt(params.days || '7')
    var now = new Date()
    var start = new Date(now.getTime() - days * 86400000).toISOString().split('T')[0]
    var end = now.toISOString().split('T')[0]

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
        transacoes: Array.isArray(results[0]) ? results[0] : [],
        vendedores: Array.isArray(results[1]) ? results[1] : [],
        metaAds: Array.isArray(results[2]) ? results[2] : [],
        metaAccounts: Array.isArray(results[3]) ? results[3] : [],
        criativos: Array.isArray(results[4]) ? results[4] : [],
        despesas: Array.isArray(results[5]) ? results[5] : [],
        periodo: { start, end, days }
      })
    }
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) }
  }
}
