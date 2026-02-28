const express = require("express");
const Iyzipay = require("iyzipay");
const router = express.Router();
const db = require("../db");

const iyzipay = new Iyzipay({
apiKey: "SANDBOX_API_KEY",
secretKey: "SANDBOX_SECRET_KEY",
uri: "https://sandbox-api.iyzipay.com"
});


// 🟢 Kart ile Ödeme Başlat
router.post("/create-payment", async (req, res) => {
const { cart, customer } = req.body;

// Backend toplam hesaplama
let totalPrice = 0;

for (let item of cart) {
const [product] = await db.promise().query(
"SELECT price, stock FROM products WHERE id = ?",
[item.id]
);

if (!product.length || product[0].stock < item.quantity) {
return res.status(400).json({ error: "Stok yetersiz" });
}

totalPrice += product[0].price * item.quantity;
}

const request = {
locale: Iyzipay.LOCALE.TR,
conversationId: JSON.stringify(customer),
price: totalPrice.toString(),
paidPrice: totalPrice.toString(),
currency: Iyzipay.CURRENCY.TRY,
basketId: JSON.stringify(cart),
paymentGroup: Iyzipay.PAYMENT_GROUP.PRODUCT,
callbackUrl: "http://localhost:3000/payment/payment-callback",
buyer: {
id: "BY789",
name: customer.name,
surname: " ",
gsmNumber: customer.phone,
email: customer.email,
identityNumber: "11111111111",
registrationAddress: customer.address,
city: "Kahramanmaraş",
country: "Turkey",
zipCode: "46000"
},
shippingAddress: {
contactName: customer.name,
city: "Kahramanmaraş",
country: "Turkey",
address: customer.address
},
billingAddress: {
contactName: customer.name,
city: "Kahramanmaraş",
country: "Turkey",
address: customer.address
},
basketItems: cart.map(item => ({
id: item.id.toString(),
name: "Elektrik Ürünü",
category1: "Elektrik",
itemType: Iyzipay.BASKET_ITEM_TYPE.PHYSICAL,
price: totalPrice.toString()
}))
};

iyzipay.checkoutFormInitialize.create(request, function (err, result) {
if (err) return res.status(500).json(err);
res.json(result);
});
});


// 🟡 Kapıda Ödeme
router.post("/cash-on-delivery", async (req, res) => {
const { cart, customer } = req.body;

let totalPrice = 0;

for (let item of cart) {
const [product] = await db.promise().query(
"SELECT price, stock FROM products WHERE id = ?",
[item.id]
);

if (!product.length || product[0].stock < item.quantity) {
return res.status(400).json({ error: "Stok yetersiz" });
}

totalPrice += product[0].price * item.quantity;

await db.promise().query(
"UPDATE products SET stock = stock - ? WHERE id = ?",
[item.quantity, item.id]
);
}

await db.promise().query(
"INSERT INTO orders (customer_name, phone, address, total_price, payment_type, order_status) VALUES (?, ?, ?, ?, ?, ?)",
[customer.name, customer.phone, customer.address, totalPrice, "Kapıda Ödeme", "Onay Bekliyor"]
);

res.json({ success: true });
});


module.exports = router;

router.post("/payment-callback", async (req, res) => {
const { token } = req.body;

const request = {
locale: Iyzipay.LOCALE.TR,
conversationId: "123456",
token: token
};

iyzipay.checkoutForm.retrieve(request, async function (err, result) {
if (err) {
console.log("Callback hata:", err);
return res.redirect("/payment-failed");
}

if (result.paymentStatus === "SUCCESS") {

const cart = JSON.parse(result.basketId);
const customer = JSON.parse(result.conversationId);

let totalPrice = 0;

for (let item of cart) {

const [product] = await db.promise().query(
"SELECT price, stock FROM products WHERE id = ?",
[item.id]
);

if (!product.length || product[0].stock < item.quantity) {
return res.redirect("/payment-failed");
}

totalPrice += product[0].price * item.quantity;

await db.promise().query(
"UPDATE products SET stock = stock - ? WHERE id = ?",
[item.quantity, item.id]
);
}

await db.promise().query(
"INSERT INTO orders (customer_name, phone, address, total_price, payment_type, order_status) VALUES (?, ?, ?, ?, ?, ?)",
[
customer.name,
customer.phone,
customer.address,
totalPrice,
"Kart",
"Hazırlanıyor"
]
);

return res.redirect("/payment-success");
} else {
return res.redirect("/payment-failed");
}
});
});

