import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { phone } = await req.json()

    if (!phone) {
      return new Response(
        JSON.stringify({ error: 'Phone number is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString()
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 minutes

    // Initialize Supabase client with service role key to bypass RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Update or create user with OTP
    // We use the 'User' table as defined in the Prisma schema
    const { error: upsertError } = await supabase
      .from('User')
      .upsert({
        phone,
        otpCode,
        otpExpires,
        email: `${phone.replace('+', '')}@whatsapp.user`,
        role: 'USER',
        isVerified: false
      }, { onConflict: 'phone' })

    if (upsertError) {
      console.error('Database error:', upsertError)
      return new Response(
        JSON.stringify({ error: 'Failed to save OTP to database' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    // Send via OTPIQ
    const otpiqApiKey = Deno.env.get('OTPIQ_API_KEY')
    const otpiqResponse = await fetch('https://api.otpiq.com/api/sms', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${otpiqApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        "phoneNumber": phone.replace('+', ''),
        "smsType": "verification",
        "provider": "whatsapp",
        "verificationCode": otpCode
      })
    })

    const otpiqData = await otpiqResponse.json()
    console.log('OTPIQ Response:', otpiqData)

    if (!otpiqResponse.ok) {
      throw new Error(otpiqData.message || 'Failed to send WhatsApp message via OTPIQ')
    }

    return new Response(
      JSON.stringify({ message: 'OTP sent successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    console.error('Error in send-otp-otpiq:', error.message)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
