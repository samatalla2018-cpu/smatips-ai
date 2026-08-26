export async function onRequestPost({ request }) {
try {
const body = await request.json();

const phone = body.phone;
const otp = body.otp || body.code;

if (!phone || !otp) {
return Response.json(
{ success: false, error: "رقم الجوال ورمز التحقق مطلوبان" },
{ status: 400 }
);
}

return Response.json({
success: true,
verified: true
});

} catch (error) {
return Response.json(
{ success: false, error: "تعذر التحقق من الرمز" },
{ status: 500 }
);
}
}
