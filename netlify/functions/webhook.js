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

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  try {
    const body = JSON.parse(event.body || '{}')
    const { cliente, produto, valor, forma_pagamento, status, modalidade, src_vendedor, data } = body

    if (!valor || !src_vendedor) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'valor e src_vendedor são obrigatórios' })
      }
    }

    // Busca vendedor pelo SRC
    const { data: vendedor } = await supabase
      .from('vendedores')
      .select('id, nome')
      .eq('src', src_vendedor.toLowerCase())
      .single()

    const { error } = await supabase.from('transacoes').insert({
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

    if (error) throw error

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, vendedor: vendedor ? vendedor.nome : src_vendedor })
    }
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    }
  }
}
