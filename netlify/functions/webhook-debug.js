const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY

exports.handler = async (event) => {
  var headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  }

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' }

  // Salva o payload no Supabase para debug
  try {
    var body = event.body || '{}'
    var parsed = {}
    try { parsed = JSON.parse(body) } catch(e) { parsed = { raw: body } }

    // Log no console do Netlify
    console.log('=== B4YOU WEBHOOK PAYLOAD ===')
    console.log(JSON.stringify(parsed, null, 2))
    console.log('=== HEADERS ===')
    console.log(JSON.stringify(event.headers, null, 2))

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ received: true, payload: parsed })
    }
  } catch(err) {
    console.error('Debug webhook error:', err.message)
    return { statusCode: 200, headers, body: JSON.stringify({ received: true }) }
  }
}
