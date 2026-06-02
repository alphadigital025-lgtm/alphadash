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

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' }

  try {
    const body = JSON.parse(event.body || '{}')

    if (body.action === 'delete') {
      await supabase.from('vendedores').update({ ativo: false }).eq('id', body.id)
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
    }

    if (body.action === 'add') {
      const { error } = await supabase.from('vendedores').insert({
        nome: body.nome.toUpperCase(),
        whatsapp: body.whatsapp || '',
        src: body.src.toLowerCase(),
        salario_fixo: parseFloat(body.salario_fixo || 0),
        meta_mensal: parseFloat(body.meta_mensal || 0),
        comissao_pct: parseFloat(body.comissao_pct || 0),
        auxilio_transporte: parseFloat(body.auxilio_transporte || 0),
        chave_pix: body.chave_pix || ''
      })
      if (error) throw error
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
    }

    if (body.action === 'add_conta') {
      const { error } = await supabase.from('meta_accounts').insert({
        nome: body.nome,
        account_id: body.account_id
      })
      if (error) throw error
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
    }

    if (body.action === 'delete_conta') {
      await supabase.from('meta_accounts').delete().eq('id', body.id)
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
    }

    if (body.action === 'add_despesa') {
      const { error } = await supabase.from('despesas').insert({
        descricao: body.descricao,
        categoria: body.categoria || 'Custo Fixo',
        valor: parseFloat(body.valor),
        data_competencia: body.data_competencia,
        data_pagamento: body.data_pagamento
      })
      if (error) throw error
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: 'action inválida' }) }
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) }
  }
}
