export async function onRequestPost({ request, env }) {
try {
const body = await request.json();
const phone = String(body.phone || "").replace(/\D/g, "");

if (!phone) {
return Response.json({ error: "رقم الجوال مطلوب" }, { status: 400 });
}

const response = await fetch("https://api.authentica.sa/api/sdk/v1/sendOTP", {
method: "POST",
headers: {
"Content-Type": "application/json",
"X-Authorization": env.AUTHENTICA_API_KEY
},
body: JSON.stringify({
phone: phone,
method: "sms"
})
});

const data = await response.json();

return Response.json(data, { status: response.status });

} catch (error) {
return Response.json(
{ error: error.message || "فشل إرسال رمز التحقق" },
{ status: 500 }
);
}
}
