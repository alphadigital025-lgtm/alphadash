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
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  }

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' }
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }

  try {
    var body = JSON.parse(event.body || '{}')

    if (body.action === 'add') {
      await sb('POST', 'vendedores', {
        nome: body.nome.toUpperCase(),
        whatsapp: body.whatsapp || '',
        src: body.src.toLowerCase(),
        salario_fixo: parseFloat(body.salario_fixo) || 0,
        meta_mensal: parseFloat(body.meta_mensal) || 0,
        comissao_pct: parseFloat(body.comissao_pct) || 0,
        auxilio_transporte: parseFloat(body.auxilio_transporte) || 0,
        chave_pix: body.chave_pix || '',
        ativo: true
      })
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
    }

    if (body.action === 'delete') {
      await sb('PATCH', 'vendedores', { ativo: false }, '?id=eq.' + body.id)
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
    }

    if (body.action === 'add_conta') {
      await sb('POST', 'meta_accounts', { nome: body.nome, account_id: body.account_id, ativo: true })
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
    }

    if (body.action === 'delete_conta') {
      await sb('DELETE', 'meta_accounts', null, '?id=eq.' + body.id)
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
    }

    if (body.action === 'delete_despesa') {
      await sb('DELETE', 'despesas', null, '?id=eq.' + body.id)
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
    }

    if (body.action === 'add_despesa') {
      await sb('POST', 'despesas', {
        descricao: body.descricao,
        categoria: body.categoria || 'Custo Fixo',
        valor: parseFloat(body.valor),
        data_competencia: body.data_competencia,
        data_pagamento: body.data_pagamento
      })
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: 'action invalida' }) }

  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) }
  }
}

