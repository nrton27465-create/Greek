const API_URL = "https://script.google.com/macros/s/AKfycbxvy0Plb5CVNjoncU224I_RIV5Dmas0v68Z-AZ6wFZIaPC2qs6llWksnWtouG33Do6x/exec"; // << ใส่ของคุณ

function loadOrders() {
  fetch(API_URL + "?action=listOrders")
    .then(r => r.json())
    .then(data => {
      const tb = document.getElementById("orders");
      tb.innerHTML = "";
      data.forEach(o => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${o.orderNo}</td>
          <td>${o.customer}</td>
          <td>${o.destination}</td>
          <td>${o.status}</td>
        `;
        tb.appendChild(tr);
      });
    });
}

function createOrder() {
  const fd = new FormData(document.getElementById("orderForm"));
  const params = new URLSearchParams(fd).toString();

  fetch(API_URL + "?action=createOrder&" + params)
    .then(r => r.json())
    .then(res => {
      alert("บันทึกแล้ว: " + res.orderNo);
      loadOrders();
    });
}

document.addEventListener("DOMContentLoaded", loadOrders);
