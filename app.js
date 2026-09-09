const WORKER_URL = "https://test-hazirla.ezgi-melisc.workers.dev";

const form = document.getElementById("test-form");
const dersSelect = document.getElementById("ders");
const dersDiger = document.getElementById("ders-diger");
const formPanel = document.getElementById("form-panel");
const yukleniyorPanel = document.getElementById("yukleniyor-panel");
const sonucPanel = document.getElementById("sonuc-panel");
const kagitIcerik = document.getElementById("kagit-icerik");
const hataMesaji = document.getElementById("hata-mesaji");
const cevapToggle = document.getElementById("cevap-goster-toggle");
const revizeForm = document.getElementById("revize-form");
const revizeIstekAlani = document.getElementById("revize-istek");
const revizeButon = document.getElementById("revize-buton");
const revizeDurum = document.getElementById("revize-durum");
const revizeHata = document.getElementById("revize-hata");

let sonUretilenVeri = null;

dersSelect.addEventListener("change", () => {
  dersDiger.style.display = dersSelect.value === "diger" ? "block" : "none";
});

document.getElementById("ornek-doldur").addEventListener("click", () => {
  dersSelect.value = "Matematik";
  dersDiger.style.display = "none";
  document.getElementById("sinif").value = "2";
  document.getElementById("unite").value = "1. Tema: Sayılar ve Nicelikler (1)";
  document.getElementById("soru-sayisi").value = "6";
  document.getElementById("sik-sayisi").value = "3";
  document.getElementById("ek-istek").value =
    "Bağlamlarda okul/ev/oyun gibi günlük durumlar kullanılsın, en az bir soru görsel bir tabloya veya şekle dayansın.";
});

document.getElementById("yeni-kagit-buton").addEventListener("click", () => {
  sonucPanel.hidden = true;
  formPanel.hidden = false;
  hataMesaji.hidden = true;
  sonUretilenVeri = null;
});

document
  .getElementById("yazdir-buton")
  .addEventListener("click", () => window.print());

cevapToggle.addEventListener("change", () => {
  kagitIcerik.classList.toggle("cevaplar-gizli", !cevapToggle.checked);
});

async function workerIstegiGonder(payload, timeoutMs = 75_000) {
  const controller = new AbortController();
  const zamanAsimi = setTimeout(() => controller.abort(), timeoutMs);
  let yanit;
  try {
    yanit = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(zamanAsimi);
  }

  if (!yanit.ok) {
    const detay = await yanit.text().catch(() => "");
    throw new Error(`Sunucu hatası (${yanit.status}). ${detay.slice(0, 200)}`);
  }
  const veri = await yanit.json();
  if (veri.hata) throw new Error(veri.hata);
  return veri;
}

function zamanAsimiMesaji(err) {
  return err.name === "AbortError"
    ? "İstek çok uzun sürdü ve zaman aşımına uğradı. Lütfen tekrar deneyin."
    : null;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  hataMesaji.hidden = true;

  const ders =
    dersSelect.value === "diger"
      ? dersDiger.value.trim() || "Ders"
      : dersSelect.value;
  const payload = {
    ders,
    sinif: document.getElementById("sinif").value,
    unite: document.getElementById("unite").value.trim(),
    materyalTuru: "test",
    soruSayisi: Number(document.getElementById("soru-sayisi").value) || 6,
    sikSayisi: Number(document.getElementById("sik-sayisi").value) || 3,
    ekIstek: document.getElementById("ek-istek").value.trim(),
  };

  formPanel.hidden = true;
  yukleniyorPanel.hidden = false;
  sonucPanel.hidden = true;

  try {
    const veri = await workerIstegiGonder(payload);
    sonUretilenVeri = veri;
    renderKagit(veri);
    cevapToggle.checked = false;
    kagitIcerik.classList.add("cevaplar-gizli");
    revizeIstekAlani.value = "";
    revizeHata.hidden = true;
    yukleniyorPanel.hidden = true;
    sonucPanel.hidden = false;
  } catch (err) {
    console.error(err);
    yukleniyorPanel.hidden = true;
    formPanel.hidden = false;
    hataMesaji.hidden = false;
    hataMesaji.textContent =
      zamanAsimiMesaji(err) ||
      "Kâğıt oluşturulamadı: " +
        err.message +
        " — Worker adresinin doğru girildiğinden ve API anahtarının tanımlı olduğundan emin olun.";
  }
});

revizeForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  revizeHata.hidden = true;

  const istek = revizeIstekAlani.value.trim();
  if (!istek) {
    revizeHata.hidden = false;
    revizeHata.textContent = "Lütfen ne değiştirmek istediğinizi yazın.";
    return;
  }
  if (!sonUretilenVeri) {
    revizeHata.hidden = false;
    revizeHata.textContent =
      "Düzenlenecek bir kâğıt bulunamadı. Önce bir kâğıt oluşturun.";
    return;
  }

  revizeButon.disabled = true;
  revizeIstekAlani.disabled = true;
  revizeDurum.textContent = "Düzenleniyor…";

  try {
    const veri = await workerIstegiGonder(
      { revizeIstek: istek, oncekiVeri: sonUretilenVeri },
      75_000,
    );
    sonUretilenVeri = veri;
    const cevaplarGorunuyorMuydu = cevapToggle.checked;
    renderKagit(veri);
    cevapToggle.checked = cevaplarGorunuyorMuydu;
    kagitIcerik.classList.toggle("cevaplar-gizli", !cevaplarGorunuyorMuydu);
    revizeIstekAlani.value = "";
    revizeDurum.textContent = "Güncellendi ✓";
    setTimeout(() => {
      revizeDurum.textContent = "";
    }, 4000);
  } catch (err) {
    console.error(err);
    revizeDurum.textContent = "";
    revizeHata.hidden = false;
    revizeHata.textContent =
      zamanAsimiMesaji(err) || "Düzenleme yapılamadı: " + err.message;
  } finally {
    revizeButon.disabled = false;
    revizeIstekAlani.disabled = false;
  }
});

function kacir(metin) {
  const d = document.createElement("div");
  d.textContent = metin ?? "";
  return d.innerHTML;
}

function renderKagit(veri) {
  const harfler = ["A", "B", "C", "D"];
  let html = "";

  html += `<div class="kagit-baslik">
    <p class="okul">……………………………… OKULU</p>
    <h2>${kacir(veri.baslik)}</h2>
    <p class="tema">${kacir(veri.ders)} · ${kacir(veri.sinif)}. Sınıf · ${kacir(veri.unite)}</p>
  </div>`;

  html += `<div class="bilgi-tablosu">
    <div><p>Ad Soyad: .................................................</p><p>Sınıf / No: ........... / ...........</p></div>
    <div><p>Tarih: ..... / ..... / 20.....</p><p>Süre: 40 dakika &nbsp; Puan: ...........</p></div>
  </div>`;

  if (veri.yonerge) {
    html += `<p class="yonerge">${kacir(veri.yonerge)}</p>`;
  }

  (veri.sorular || []).forEach((soru) => {
    const baglamParagraflari = Array.isArray(soru.baglam_metni)
      ? soru.baglam_metni.filter((p) => p && p.trim())
      : soru.baglam_metni && soru.baglam_metni.trim()
        ? [soru.baglam_metni]
        : [];

    if (
      baglamParagraflari.length ||
      (soru.baglam_baslik && soru.baglam_baslik.trim())
    ) {
      html += `<div class="baglam-kutu">`;
      if (soru.baglam_baslik && soru.baglam_baslik.trim()) {
        html += `<p class="baglam-baslik">${kacir(soru.baglam_baslik)}</p>`;
      }
      baglamParagraflari.forEach((p) => {
        html += `<p>${kacir(p)}</p>`;
      });
      html += `</div>`;
    }

    html += `<div class="soru-blok">`;
    html += `<p class="soru-metni">${soru.no}. ${kacir(soru.soru)}</p>`;
    html += `<ul class="secenekler">`;
    (soru.secenekler || []).forEach((sec) => {
      const dogruMu = sec.harf === soru.dogru;
      html += `<li class="${dogruMu ? "cevap-dogru" : ""}">
        <span class="harf">${kacir(sec.harf)})</span>${kacir(sec.metin)}
      </li>`;
    });
    html += `</ul>`;
    if (soru.kazanim)
      html += `<p class="kazanim-etiketi">Kazanım/süreç bileşeni: ${kacir(soru.kazanim)}</p>`;
    html += `</div>`;
  });

  html += `<div class="cevap-anahtari">
    <h3>Öğretmen Nüshası — Cevap Anahtarı ve Kazanım Takip Tablosu</h3>
    <table class="cevap-tablosu">
      <thead><tr><th>Soru</th><th>Ölçülen kazanım / süreç bileşeni</th><th>Doğru cevap</th><th>Güçlük</th></tr></thead>
      <tbody>`;
  (veri.sorular || []).forEach((soru) => {
    html += `<tr>
      <td>${soru.no}</td>
      <td>${kacir(soru.kazanim || "")}</td>
      <td>${kacir(soru.dogru || "")}</td>
      <td>${kacir(soru.guclukk || "")}</td>
    </tr>`;
  });
  html += `</tbody></table>`;
  if (veri.not_metni)
    html += `<p class="not-metni">${kacir(veri.not_metni)}</p>`;
  html += `</div>`;

  kagitIcerik.innerHTML = html;
}
