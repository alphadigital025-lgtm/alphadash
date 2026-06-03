const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY

async function sb(method, table, body, query) {
  var url = SUPABASE_URL + '/rest/v1/' + table + (query || '')
  var res = await fetch(url, {
    method: method,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: body ? JSON.stringify(body) : undefined
  })
  var text = await res.text()
  try { return JSON.parse(text) } catch(e) { return null }
}

exports.handler = async (event) => {
  var headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  }

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' }
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }

  try {
    var body = JSON.parse(event.body || '{}')
    var { cliente, produto, valor, forma_pagamento, status, modalidade, src_vendedor, data } = body

    if (!valor || !src_vendedor) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'valor e src_vendedor sao obrigatorios' }) }
    }

    var vendedores = await sb('GET', 'vendedores', null, '?src=eq.' + src_vendedor.toLowerCase() + '&limit=1')
    var vendedor = Array.isArray(vendedores) && vendedores.length > 0 ? vendedores[0] : null

    await sb('POST', 'transacoes', {
      data: data || new Date().toISOString().split('T')[0],
      cliente: cliente || 'Cliente',
      produto: produto || 'Produto',
      valor: parseFloat(valor),
      modalidade: modalidade || 'Venda',
      status: status || 'Pago',
      forma_pagamento: forma_pagamento || 'Outro',
      src_vendedor: src_vendedor.toLowerCase(),
      vendedor_id: vendedor ? vendedor.id : null,
      vendedor_nome: vendedor ? vendedor.nome : src_vendedor
    })

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, vendedor: vendedor ? vendedor.nome : src_vendedor }) }

  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) }
  }
}
