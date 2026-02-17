// ====== CONFIG ======
const API_URL = "https://script.google.com/macros/s/XXXX/exec"; // <<<<<< ใส่ของคุณ

// ====== helpers ======
function qs(sel, root=document){ return root.querySelector(sel); }
function qsa(sel, root=document){ return [...root.querySelectorAll(sel)]; }

function money(n){
  const v = Number(n||0);
  return v.toLocaleString("th-TH", { maximumFractionDigits: 2 });
}

function escapeHtml(s){
  return (s ?? "").toString()
    .replaceAll("&","&amp;").replaceAll("<","&lt;")
    .replaceAll(">","&gt;").replaceAll('"',"&quot;")
    .replaceAll("'","&#39;");
}

async function apiGet(action, payload={}){
  const url = new URL(API_URL);
  url.searchParams.set("action", action);
  // optional payload in GET (small)
  if(payload && Object.keys(payload).length){
    url.searchParams.set("payload", JSON.stringify(payload));
  }
  const res = await fetch(url.toString(), { method:"GET" });
  const json = await res.json();
  if(!json.success) throw new Error(json.error || "API error");
  return json.data;
}

async function apiPost(action, payload={}){
  const res = await fetch(API_URL, {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({ action, payload })
  });
  const json = await res.json();
  if(!json.success) throw new Error(json.error || "API error");
  return json.data;
}

function badge(status){
  const map = {
    NEW:"secondary", PLANNED:"info", ASSIGNED:"primary", DELIVERED:"success",
    IN_TRANSIT:"warning", ARRIVED:"info", CLOSED:"secondary"
  };
  const cls = map[status] || "dark";
  return `<span class="badge text-bg-${cls}">${escapeHtml(status)}</span>`;
}

// ====== OFFICE ======
async function officeInit(){
  // bind buttons
  qs("#btnRefresh").addEventListener("click", officeLoadAll);
  qs("#btnSeed").addEventListener("click", async ()=>{
    await apiPost("seed",{});
    alert("ใส่รถ/คนขับตัวอย่างแล้ว ✅");
    await officeLoadAll();
  });

  qs("#orderForm").addEventListener("submit", async (e)=>{
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = Object.fromEntries(fd.entries());
    payload.qtyTon = Number(payload.qtyTon);
    payload.saleAmount = Number(payload.saleAmount);

    const r = await apiPost("createOrder", payload);
    alert(`บันทึกออเดอร์แล้ว ✅ (${r.orderNo})`);
    e.target.reset();
    qs('input[name="date"]').valueAsDate = new Date();
    await officeLoadAll();
  });

  qs("#btnPlan").addEventListener("click", async ()=>{
    const orderId = qs("#selOrder").value;
    const planKm = Number(qs("#planKm").value||0);
    const planFuelLiters = Number(qs("#planFuel").value||0);
    if(!orderId) return alert("กรุณาเลือกออเดอร์");
    if(planKm<=0 || planFuelLiters<=0) return alert("กรุณากรอกแผน (กม./น้ำมัน)");
    await apiPost("planOrder", { orderId, planKm, planFuelLiters });
    alert("บันทึกวางแผนแล้ว ✅");
    await officeLoadAll();
  });

  qs("#btnAssign").addEventListener("click", async ()=>{
    const orderId = qs("#selOrder").value;
    const carPlate = qs("#selCar").value;
    const driverName = qs("#selDriver").value;
    if(!orderId) return alert("กรุณาเลือกออเดอร์");
    if(!carPlate || !driverName) return alert("กรุณาเลือกรถและคนขับ");
    const r = await apiPost("assignTrip", { orderId, carPlate, driverName });
    alert(`มอบหมายแล้ว ✅ (${r.tripNo})`);
    await officeLoadAll();
  });

  qs("#fuelForm").addEventListener("submit", async (e)=>{
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = Object.fromEntries(fd.entries());
    payload.liters = Number(payload.liters);
    payload.pricePerLiter = Number(payload.pricePerLiter);

    const r = await apiPost("addFuel", payload);
    alert(`บันทึกเติมน้ำมันแล้ว ✅ (ยอด ${money(r.amount)} บาท)`);
    e.target.reset();
    await officeLoadAll();
  });

  qs("#btnSaveCost").addEventListener("click", async ()=>{
    const laborPerTrip = Number(qs("#laborPerTrip").value||0);
    const otherPerTrip = Number(qs("#otherPerTrip").value||0);
    await apiPost("updateCostSettings", { laborPerTrip, otherPerTrip });
    alert("บันทึกตั้งค่าแล้ว ✅");
    await officeLoadAll();
  });

  // default date
  qs('input[name="date"]').valueAsDate = new Date();

  // load
  await officeLoadAll();
}

async function officeLoadAll(){
  // parallel
  const [orders, trips, cars, drivers, summary] = await Promise.all([
    apiGet("listOrders"),
    apiGet("listTrips"),
    apiGet("listCars"),
    apiGet("listDrivers"),
    apiGet("getCostSummary")
  ]);

  window.__orders = orders;
  window.__trips = trips;

  // orders table
  const tbO = qs("#ordersTbody");
  tbO.innerHTML = orders.map(o=>`
    <tr>
      <td class="mono">${escapeHtml(o.orderNo)}</td>
      <td>${escapeHtml(o.date)}</td>
      <td>${escapeHtml(o.customer)}</td>
      <td>${escapeHtml(o.destination)}</td>
      <td class="text-end">${Number(o.qtyTon||0).toFixed(2)}</td>
      <td class="text-end">${money(o.saleAmount)}</td>
      <td>${badge(o.status)}</td>
      <td class="text-end">${o.planKm===""?"":money(o.planKm)}</td>
      <td class="text-end">${o.planFuelLiters===""?"":money(o.planFuelLiters)}</td>
    </tr>
  `).join("");

  // manage order dropdown (NEW/PLANNED/ASSIGNED)
  const selOrder = qs("#selOrder");
  const manageable = orders.filter(o=>["NEW","PLANNED","ASSIGNED"].includes(o.status));
  selOrder.innerHTML = manageable.map(o=>`
    <option value="${o.orderId}">${o.orderNo} | ${o.customer} | ${o.destination}</option>
  `).join("");
  selOrder.onchange = ()=>{
    const id = selOrder.value;
    const o = orders.find(x=>x.orderId===id);
    qs("#planKm").value = o && o.planKm !== "" ? o.planKm : "";
    qs("#planFuel").value = o && o.planFuelLiters !== "" ? o.planFuelLiters : "";
  };
  if(manageable[0]){
    selOrder.value = manageable[0].orderId;
    selOrder.onchange();
  }else{
    qs("#planKm").value = "";
    qs("#planFuel").value = "";
  }

  // cars/drivers dropdowns
  qs("#selCar").innerHTML = cars.map(c=>`<option value="${escapeHtml(c.plate)}">${escapeHtml(c.plate)}</option>`).join("");
  qs("#selDriver").innerHTML = drivers.map(d=>`<option value="${escapeHtml(d.name)}">${escapeHtml(d.name)}</option>`).join("");

  // trips table
  const tbT = qs("#tripsTbody");
  tbT.innerHTML = trips.map(t=>`
    <tr>
      <td class="mono">${escapeHtml(t.tripNo)}</td>
      <td class="mono">${escapeHtml(t.orderNo)}</td>
      <td>${escapeHtml(t.carPlate||"")}</td>
      <td>${escapeHtml(t.driverName||"")}</td>
      <td>${badge(t.status)}</td>
      <td class="text-end">${t.actualKm===""?"":money(t.actualKm)}</td>
      <td class="text-end">${t.actualFuelLiters===""?"":money(t.actualFuelLiters)}</td>
      <td>${escapeHtml(t.driverNote||"")}</td>
    </tr>
  `).join("");

  // fuel trips dropdown
  qs("#selFuelTrip").innerHTML = trips.map(t=>`
    <option value="${t.tripId}">${t.tripNo} | ${t.orderNo} | ${t.carPlate} | ${t.driverName} | ${t.status}</option>
  `).join("");

  // summary settings
  qs("#laborPerTrip").value = summary.settings.laborPerTrip;
  qs("#otherPerTrip").value = summary.settings.otherPerTrip;

  // summary table
  const tbS = qs("#sumTbody");
  tbS.innerHTML = summary.rows.map(r=>{
    const cls = Number(r.profit) >= 0 ? "text-success fw-bold" : "text-danger fw-bold";
    return `
      <tr>
        <td class="mono">${escapeHtml(r.tripNo)}</td>
        <td class="mono">${escapeHtml(r.orderNo)}</td>
        <td>${escapeHtml(r.carPlate||"")}</td>
        <td>${escapeHtml(r.driverName||"")}</td>
        <td>${badge(r.tripStatus)}</td>
        <td class="text-end">${money(r.saleAmount)}</td>
        <td class="text-end">${money(r.fuelCost)}</td>
        <td class="text-end">${money(r.laborCost)}</td>
        <td class="text-end">${money(r.otherCost)}</td>
        <td class="text-end ${cls}">${money(r.profit)}</td>
      </tr>
    `;
  }).join("");
}

// ====== DRIVER ======
async function driverInit(){
  qs("#btnRefresh").addEventListener("click", driverLoadAll);
  qs("#btnSeed").addEventListener("click", async ()=>{
    await apiPost("seed",{});
    alert("ใส่รถ/คนขับตัวอย่างแล้ว ✅");
    await driverLoadAll();
  });

  qs("#selDriver").addEventListener("change", driverLoadTrips);

  qs("#actualForm").addEventListener("submit", async (e)=>{
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = Object.fromEntries(fd.entries());
    payload.actualKm = Number(payload.actualKm);
    payload.actualFuelLiters = Number(payload.actualFuelLiters);

    if(!payload.tripId) return alert("กรุณาเลือก Trip");
    await apiPost("setTripActual", payload);
    alert("บันทึกผลจริงแล้ว ✅ (ปิดงานเป็น CLOSED)");
    e.target.reset();
    await driverLoadTrips();
  });

  await driverLoadAll();
}

async function driverLoadAll(){
  const drivers = await apiGet("listDrivers");
  const sel = qs("#selDriver");
  sel.innerHTML = drivers.length
    ? drivers.map(d=>`<option value="${escapeHtml(d.name)}">${escapeHtml(d.name)}</option>`).join("")
    : `<option value="">-- ไม่มีรายชื่อคนขับ --</option>`;

  await driverLoadTrips();
}

async function driverLoadTrips(){
  const name = qs("#selDriver").value;
  const tb = qs("#tbTrips");
  const selActual = qs("#selTripActual");

  if(!name){
    tb.innerHTML = "";
    selActual.innerHTML = "";
    return;
  }

  const trips = await apiPost("listTripsByDriver", { driverName: name });

  tb.innerHTML = trips.map(t=>{
    return `
      <tr>
        <td class="mono">${escapeHtml(t.tripNo)}</td>
        <td class="mono">${escapeHtml(t.orderNo)}</td>
        <td>${escapeHtml(t.carPlate||"")}</td>
        <td>${badge(t.status)}</td>
        <td class="d-flex gap-2 flex-wrap">
          <button class="btn btn-sm btn-warning" data-id="${t.tripId}" data-st="IN_TRANSIT">เริ่มงาน</button>
          <button class="btn btn-sm btn-info" data-id="${t.tripId}" data-st="ARRIVED">ถึงจุดส่ง</button>
          <button class="btn btn-sm btn-success" data-id="${t.tripId}" data-st="DELIVERED">ส่งสำเร็จ</button>
        </td>
      </tr>
    `;
  }).join("");

  // bind status buttons
  qsa('button[data-id][data-st]', tb).forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const tripId = btn.getAttribute("data-id");
      const status = btn.getAttribute("data-st");
      await apiPost("updateTripStatus", { tripId, status });
      await driverLoadTrips();
    });
  });

  // actual select: show all not CLOSED (ให้กรอก actual ได้)
  const options = trips
    .filter(t=>t.status !== "CLOSED")
    .map(t=>`<option value="${t.tripId}">${t.tripNo} | ${t.orderNo} | ${t.status}</option>`)
    .join("");
  selActual.innerHTML = options || `<option value="">-- ไม่มีงานให้เลือก --</option>`;
}
