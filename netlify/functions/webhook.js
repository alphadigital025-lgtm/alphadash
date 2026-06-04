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
      'Prefer': method === 'POST' ? 'return=representation' : ''
    },
    body: body ? JSON.stringify(body) : undefined
  })
  var text = await res.text()
  try { return JSON.parse(text) } catch(e) { return text }
}

exports.handler = async (event) => {
  var headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  }

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' }
  // Sempre retorna 200 para a B4You nao retentar infinitamente
  if (event.httpMethod !== 'POST') return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) }

  try {
    var body = JSON.parse(event.body || '{}')

    // Log para debug
    console.log('WEBHOOK RECEBIDO:', JSON.stringify(body))
    console.log('QUERY PARAMS:', JSON.stringify(event.queryStringParameters))

    // Suporta tanto formato B4You quanto formato manual
    var isB4You = !!body.event_name

    if (isB4You) {
      // Formato B4You
      var eventName = body.event_name || ''

      // So processa compras aprovadas
      if (eventName !== 'approved-payment') {
        return { statusCode: 200, headers, body: JSON.stringify({ ignored: true, event: eventName }) }
      }

      // Status mapping
      var statusMap = { 'paid': 'Pago', 'pending': 'Pendente', 'refunded': 'Reembolsado', 'cancelled': 'Cancelado' }
      var status = statusMap[body.status] || body.status || 'Pago'

      // Forma de pagamento
      var pagMap = { 'card': 'CARTAO', 'pix': 'PIX', 'billet': 'BOLETO', 'boleto': 'BOLETO' }
      var formaPag = pagMap[body.payment_method] || body.payment_method || 'Outro'

      // Valor: offer.original_price ou amount
      var valor = parseFloat(body.offer && body.offer.original_price ? body.offer.original_price : (body.amount || 0))

      // Produto
      var produto = body.offer && body.offer.name ? body.offer.name : (body.product && body.product.name ? body.product.name : 'Produto')

      // Cliente
      var cliente = body.customer && body.customer.full_name ? body.customer.full_name : 'Cliente'

      // SRC do atendente - verifica em todos os lugares possiveis
      var params = event.queryStringParameters || {}
      var trackingParams = body.tracking_parameters || {}
      var srcRaw = params.src
        || trackingParams.src
        || trackingParams.utm_source
        || body.src
        || body.utm_source
        || body.seller
        || null
      var srcVendedor = srcRaw ? String(srcRaw) : 'desconhecido'
      console.log('SRC detectado:', srcVendedor)

      // Cupom de desconto
      var cupom = body.coupon || null
      console.log('CUPOM detectado:', cupom)

      // Data
      var data = body.paid_at ? body.paid_at.split('T')[0] : new Date().toISOString().split('T')[0]

      // Busca vendedor pelo SRC
      var vendedor = null
      if (srcVendedor) {
        var vendedores = await sb('GET', 'vendedores', null, '?src=eq.' + srcVendedor.toLowerCase() + '&limit=1')
        vendedor = Array.isArray(vendedores) && vendedores.length > 0 ? vendedores[0] : null
      }

      var { error } = await sb('POST', 'transacoes', {
        data: data,
        cliente: cliente,
        produto: produto,
        valor: valor,
        modalidade: 'Venda',
        status: status,
        forma_pagamento: formaPag,
        src_vendedor: srcVendedor ? srcVendedor.toLowerCase() : 'desconhecido',
        vendedor_id: vendedor ? vendedor.id : null,
        vendedor_nome: vendedor ? vendedor.nome : (srcVendedor || 'Desconhecido'),
        sale_id: body.sale_id || null,
        cupom: cupom
      })

      if (error && error.message) throw new Error(error.message)

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, vendedor: vendedor ? vendedor.nome : 'nao identificado', valor: valor, cupom: cupom })
      }

    } else {
      // Formato manual (para testes)
      var { cliente, produto, valor, forma_pagamento, status, modalidade, src_vendedor, data } = body

      if (!valor || !src_vendedor) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'valor e src_vendedor sao obrigatorios' }) }
      }

      var vendedores2 = await sb('GET', 'vendedores', null, '?src=eq.' + src_vendedor.toLowerCase() + '&limit=1')
      var vendedor2 = Array.isArray(vendedores2) && vendedores2.length > 0 ? vendedores2[0] : null

      var result = await sb('POST', 'transacoes', {
        data: data || new Date().toISOString().split('T')[0],
        cliente: cliente || 'Cliente',
        produto: produto || 'Produto',
        valor: parseFloat(valor),
        modalidade: modalidade || 'Venda',
        status: status || 'Pago',
        forma_pagamento: forma_pagamento || 'Outro',
        src_vendedor: src_vendedor.toLowerCase(),
        vendedor_id: vendedor2 ? vendedor2.id : null,
        vendedor_nome: vendedor2 ? vendedor2.nome : src_vendedor
      })

      return { statusCode: 200, headers, body: JSON.stringify({ success: true, vendedor: vendedor2 ? vendedor2.nome : src_vendedor }) }
    }

  } catch (err) {
    console.error('Webhook error:', err.message)
    // Sempre retorna 200 para evitar retentativas infinitas da B4You
    return { statusCode: 200, headers, body: JSON.stringify({ received: true, error: err.message }) }
  }
}
