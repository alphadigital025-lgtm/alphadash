const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' }
  }

  try {
    const params = event.queryStringParameters || {}
    const days = parseInt(params.days || '7')
    const now = new Date()
    const start = new Date(now.getTime() - days * 86400000).toISOString().split('T')[0]
    const end = now.toISOString().split('T')[0]

    const [t, v, m, ma, cr, d] = await Promise.all([
      supabase.from('transacoes').select('*').gte('data', start).lte('data', end).order('data', { ascending: false }),
      supabase.from('vendedores').select('*').eq('ativo', true),
      supabase.from('meta_ads_daily').select('*').gte('data', start).lte('data', end),
      supabase.from('meta_accounts').select('*').eq('ativo', true),
      supabase.from('meta_criativos').select('*').gte('data', start).lte('data', end).order('spend', { ascending: false }).limit(50),
      supabase.from('despesas').select('*').gte('data_pagamento', start).lte('data_pagamento', end)
    ])

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        transacoes: t.data || [],
        vendedores: v.data || [],
        metaAds: m.data || [],
        metaAccounts: ma.data || [],
        criativos: cr.data || [],
        despesas: d.data || [],
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
