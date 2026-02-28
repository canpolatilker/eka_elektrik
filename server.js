

const express = require("express");
const mysql = require("mysql2");
const path = require("path");
const Iyzipay = require("iyzipay");
const session=require("express-session");
const app = express();
const paymentRoutes = require("./routes/payment");

app.use("/payment",paymentRoutes);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(session({
    secret:"ekaelektrikgizli",
    resave:false,
    saveUninitialized:true
}));

const iyzipay = new Iyzipay({
apiKey: "sandbox-APIKEY",
secretKey: "sandbox-SECRETKEY",
uri: "https://sandbox-api.iyzipay.com"
});

/* ================= PAYMENT CREATE ================= */

app.post("/create-payment", (req, res) => {
const { referenceId, amount } = req.body;

const request = {
locale: Iyzipay.LOCALE.TR,
conversationId: referenceId.toString(),
price: amount.toString(),
paidPrice: amount.toString(),
currency: Iyzipay.CURRENCY.TRY,
installment: "1",
basketId: referenceId.toString(),
paymentGroup: Iyzipay.PAYMENT_GROUP.PRODUCT,
callbackUrl: "http://localhost:3000/payment-callback",

buyer: {
id: "BY123",
name: "Test",
surname: "User",
gsmNumber: "+905000000000",
email: "test@test.com",
identityNumber: "11111111111",
registrationAddress: "Kizilca",
ip: req.ip,
city: "Kütahya",
country: "Turkey"
},

shippingAddress: {
contactName: "Test User",
city: "Kütahya",
country: "Turkey",
address: "Kizilca"
},

billingAddress: {
contactName: "Test User",
city: "Kütahya",
country: "Turkey",
address: "Kizilca"
},

basketItems: [
{
id: referenceId.toString(),
name: "Randevu Ödemesi",
category1: "Hizmet",
itemType: Iyzipay.BASKET_ITEM_TYPE.VIRTUAL,
price: amount.toString()
}
]
};

iyzipay.threedsInitialize.create(request, (err, result) => {
if (err) return res.status(500).send("Ödeme başlatılamadı");
res.send(result.threeDSHtmlContent);
});
});

/* ================= PAYMENT CALLBACK ================= */

app.post("/payment-callback", (req, res) => {
console.log("CALLBACK:", req.body);
res.send("Ödeme işlemi tamamlandı");
});

/* ================= MYSQL ================= */

const db = mysql.createConnection({
host: "localhost",
user: "root",
password: "",
database: "eka_elektrik"
});

db.connect(err => {
if (err) console.error("MySQL bağlantı hatası:", err);
else console.log("MySQL bağlandı");
});

/* ================= RANDEVU ================= */

app.post("/randevu", (req, res) => {
const { ad, soyad, telefon, ariza, tarih, saat } = req.body;

const sql = `
INSERT INTO appointments (name, phone, service, appointment_date)
VALUES (?, ?, ?, ?)
`;

const fullName = ad + " " + soyad;
const fullDate = tarih + " " + saat;

db.query(sql, [fullName, telefon, ariza, fullDate], (err) => {
if (err) return res.status(500).json({ error: "DB HATA" });
res.json({ message: "Kaydedildi" });
});
});

/* ================= ADMIN ================= */

app.get("/appointments", (req, res) => {
db.query(
"SELECT*FROM appointments",
(err, results) => {
if (err) {
    console.log("SQL HATASI:",err);
    res.status(500).send("Database error");
} else {
res.json(results);
}
}
);
}
);

app.put("/admin/onayla/:id", (req, res) => {
db.query(
"UPDATE appointments SET status='approved' WHERE id=?",
[req.params.id],
err => {
if (err) return res.status(500).json(err);
res.json({ message: "Onaylandı" });
}
);
});

app.delete("/admin/sil/:id", (req, res) => {
db.query(
"DELETE FROM appointments WHERE id=?",
[req.params.id],
err => {
if (err) return res.status(500).json(err);
res.json({ message: "Silindi" });
}
);
});

/* ================= SERVER ================= */

app.listen(3000, () => {
console.log("Server 3000 portunda çalışıyor");
});

app.post("/payment/:id", (req, res) => {
const id = req.params.id;

db.query(
"UPDATE appointments SET payment_status = 'Ödendi' WHERE id = ?",
[id],
(err, result) => {
if (err) {
console.log(err);
res.status(500).send("Ödeme güncellenemedi");
} else {
res.send("Ödeme güncellendi");
}
}
);
});

app.get("/payment-success", (req,res)=> {
    res.send("Odeme başarılı Siparişiniz alındı.");
});

app.get("/payment-failed", (req,res)=> {
    res.send("Odeme başarısız Lütfen tekrar deneyin.");

});
