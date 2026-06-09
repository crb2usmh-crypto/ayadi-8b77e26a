export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>خطأ في الخادم — أيادي</title>
<style>
  body { margin:0; font-family: system-ui, -apple-system, "Segoe UI", Tahoma, sans-serif; background:#0b0b10; color:#f5f5f7; display:flex; align-items:center; justify-content:center; min-height:100vh; padding:1.5rem; }
  .card { max-width: 420px; text-align:center; background:#16161d; border-radius:1rem; padding:2rem; box-shadow: 0 20px 60px rgba(0,0,0,.4); }
  h1 { margin:0 0 .5rem; font-size:1.5rem; }
  p { color:#a1a1aa; margin:.5rem 0 1.5rem; line-height:1.6; }
  .row { display:flex; gap:.5rem; justify-content:center; flex-wrap:wrap; }
  button, a { display:inline-block; padding:.7rem 1.2rem; border-radius:9999px; border:0; font-weight:600; cursor:pointer; text-decoration:none; }
  .primary { background:#7c3aed; color:#fff; }
  .ghost { background:transparent; color:#f5f5f7; border:1px solid #2a2a35; }
</style>
</head>
<body>
  <div class="card">
    <h1>حدث خطأ غير متوقع</h1>
    <p>نعتذر، تعذّر تحميل الصفحة. حاول التحديث أو العودة إلى الصفحة الرئيسية.</p>
    <div class="row">
      <button class="primary" onclick="location.reload()">تحديث</button>
      <a class="ghost" href="/">الصفحة الرئيسية</a>
    </div>
  </div>
</body>
</html>`;
}