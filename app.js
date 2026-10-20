// Keuanganku - logika aplikasi
import {firebaseConfig} from "./firebase-config.js";
import {initializeApp} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {getAuth,onAuthStateChanged,signInWithEmailAndPassword,createUserWithEmailAndPassword,signOut} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {getFirestore,collection,addDoc,deleteDoc,doc,onSnapshot} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

var $=function(i){return document.getElementById(i)};
var KO=["Makan","Bensin","Belanja","Tagihan","Kouta","Kesehatan","Lainnya"];
var KI=["Gaji","Usaha","Bonus","Lainnya"];
var data=[],tipe="out",uid=null,stop=null;

var configured=firebaseConfig.apiKey.indexOf("ISI_")!==0;
var auth,db;
if(configured){var app=initializeApp(firebaseConfig);auth=getAuth(app);db=getFirestore(app)}
else{$("auth").hidden=false;$("err").textContent="Konfigurasi Firebase belum diisi. Lihat bagian atas script."}

function rp(n){return "Rp"+Math.round(n).toLocaleString("id-ID")}
function ym(d){return d.slice(0,7)}
function col(){return collection(db,"users",uid,"transaksi")}

// 2. Login / daftar / keluar
function pesan(e){
  var m={"auth/invalid-credential":"Email atau kata sandi salah.","auth/email-already-in-use":"Email sudah terdaftar.","auth/weak-password":"Kata sandi minimal 6 karakter.","auth/invalid-email":"Format email tidak valid."};
  $("err").textContent=m[e.code]||"Gagal: "+e.code;
}
$("bLogin").onclick=function(){if(!configured)return;signInWithEmailAndPassword(auth,$("em").value.trim(),$("pw").value).catch(pesan)};
$("bDaftar").onclick=function(){if(!configured)return;createUserWithEmailAndPassword(auth,$("em").value.trim(),$("pw").value).catch(pesan)};
$("out").onclick=function(){signOut(auth)};

// 3. Saat status login berubah, mulai atau hentikan pemantauan data
if(configured)onAuthStateChanged(auth,function(user){
  if(stop){stop();stop=null}
  if(user){
    uid=user.uid;$("auth").hidden=true;$("app").hidden=false;tutupRiwayat();
    // onSnapshot: dipanggil setiap data berubah, dari perangkat mana pun
    stop=onSnapshot(col(),function(snap){
      data=snap.docs.map(function(d){var x=d.data();x.id=d.id;return x});
      fillBln();render();
    });
  }else{uid=null;data=[];$("app").hidden=true;$("auth").hidden=false}
});

// 4. Tampilan (sama seperti versi sebelumnya)
function fillKat(){$("kat").innerHTML=(tipe==="out"?KO:KI).map(function(k){return "<option>"+k+"</option>"}).join("")}
function setTipe(t){tipe=t;$("bOut").className=t==="out"?"on":"";$("bIn").className=t==="in"?"on":"";fillKat()}
function fillBln(){
  var set={};set[ym(new Date().toISOString())]=1;
  data.forEach(function(x){set[ym(x.d)]=1});
  var cur=$("bln").value;
  var keys=Object.keys(set).sort().reverse();
  $("bln").innerHTML=keys.map(function(k){
    var d=new Date(k+"-01T00:00:00");
    return '<option value="'+k+'">'+d.toLocaleDateString("id-ID",{month:"long",year:"numeric"})+"</option>"}).join("");
  if(cur&&set[cur])$("bln").value=cur;
}
function render(){
  var m=$("bln").value;
  var rows=data.filter(function(x){return ym(x.d)===m}).sort(function(a,b){return b.d.localeCompare(a.d)||b.ts-a.ts});
  var ti=0,to=0,cat={};
  rows.forEach(function(x){if(x.t==="in")ti+=x.a;else{to+=x.a;cat[x.k]=(cat[x.k]||0)+x.a}});
  $("tin").textContent=rp(ti);$("tout").textContent=rp(to);
  var s=$("saldo");s.textContent=(ti-to<0?"-":"")+rp(Math.abs(ti-to));s.className=ti-to<0?"out":"";
  var ks=Object.keys(cat).sort(function(a,b){return cat[b]-cat[a]});
  $("cat").innerHTML=ks.length?ks.map(function(k){var p=cat[k]/to*100;
    return '<div class="bar"><span><span>'+k+"</span><span>"+rp(cat[k])+" ("+Math.round(p)+'%)</span></span><div class="t"><i style="width:'+p+'%"></i></div></div>'}).join(""):'<div class="empty">Belum ada pengeluaran bulan ini.</div>';
  $("list").innerHTML=rows.length?rows.map(function(x){
    var d=new Date(x.d+"T00:00:00").toLocaleDateString("id-ID",{day:"numeric",month:"short"});
    var n=(x.n||"").replace(/</g,"&lt;");
    return '<li><div class="m"><b>'+x.k+"</b><small>"+d+(n?" · "+n:"")+'</small></div><span class="a '+x.t+'">'+(x.t==="in"?"+":"-")+rp(x.a)+'</span><button data-id="'+x.id+'" aria-label="Hapus transaksi">×</button></li>'}).join(""):'<li class="empty">Belum ada transaksi. Catat yang pertama di atas.</li>';
}

// 5. Simpan dan hapus ke Firestore
$("bOut").onclick=function(){setTipe("out")};
$("bIn").onclick=function(){setTipe("in")};
$("bln").onchange=render;
$("f").onsubmit=function(e){
  e.preventDefault();
  var a=parseFloat($("amt").value);if(!(a>0))return;
  var tgl=$("tgl").value;
  addDoc(col(),{t:tipe,a:a,k:$("kat").value,d:tgl,n:$("note").value.trim(),ts:Date.now()});
  $("amt").value="";$("note").value="";$("bln").value=ym(tgl);
};
$("list").onclick=function(e){
  var id=e.target.getAttribute&&e.target.getAttribute("data-id");if(!id)return;
  deleteDoc(doc(db,"users",uid,"transaksi",id));
};
$("exp").onclick=function(){
  var csv="Tanggal,Jenis,Kategori,Jumlah,Catatan\n"+data.map(function(x){return [x.d,x.t==="in"?"Pemasukan":"Pengeluaran",x.k,x.a,'"'+(x.n||"").replace(/"/g,'""')+'"'].join(",")}).join("\n");
  var w=window.open("","_blank");if(w){w.document.write("<pre>"+csv.replace(/</g,"&lt;")+"</pre>")}
};
$("clr").onclick=function(){
  if(confirm("Hapus semua transaksi? Tindakan ini tidak bisa dibatalkan.")){data.forEach(function(x){deleteDoc(doc(db,"users",uid,"transaksi",x.id))})}
};
// 6. Tampilkan atau sembunyikan riwayat (tersembunyi secara bawaan)
function tutupRiwayat(){$("list").classList.remove("buka");$("tg").textContent="Tampilkan";$("tg").setAttribute("aria-expanded","false")}
$("tg").onclick=function(){
  var b=$("list").classList.toggle("buka");
  $("tg").textContent=b?"Sembunyikan":"Tampilkan";
  $("tg").setAttribute("aria-expanded",b);
};
$("tgl").value=new Date().toISOString().slice(0,10);
fillKat();
