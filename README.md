# 777 Kazino — Fruit Slot Demo

Bu layihə yalnız virtual demo AZN üçündür. Real pul, depozit, pul çıxarışı və bank əməliyyatı yoxdur.

## Lokal işə salmaq
1. Node.js 20 və ya daha yeni versiya quraşdırın.
2. Bu qovluqda terminal açın.
3. `npm install`
4. Güclü iki gizli dəyər yaradın:
   - `SESSION_SECRET`: ən azı 32 simvolluq təsadüfi mətn
   - `ADMIN_PASSWORD`: ən azı 12 simvolluq admin şifrəsi
5. Mac/Linux:
   `SESSION_SECRET="buraya-uzun-tesadufi-secret" ADMIN_PASSWORD="guclu-admin-sifresi" npm start`

   Windows PowerShell:
   `$env:SESSION_SECRET="buraya-uzun-tesadufi-secret"; $env:ADMIN_PASSWORD="guclu-admin-sifresi"; npm start`
6. Brauzerdə `http://localhost:3000` açın.
7. Admin panel: `http://localhost:3000/admin`

## Render
- Build Command: `npm install`
- Start Command: `npm start`
- Root Directory: boş (repo kökündədirsə)
- Environment Variables:
  - `SESSION_SECRET` — 32+ simvolluq təsadüfi mətn
  - `ADMIN_PASSWORD` — 12+ simvolluq güclü admin şifrəsi
  - `NODE_ENV` — `production`
  - `DATA_DIR` — Render persistent disk mount path, məsələn `/var/data` (disk mount path-i də `/var/data` seçin)
- Davamlı SQLite məlumatı üçün Render persistent disk qoşun, mount path-i `/var/data` seçin və `DATA_DIR=/var/data` environment variable əlavə edin. Beləliklə, `777-kazino.sqlite` və `sessions.sqlite` faylları diskdə saxlanacaq.

## İstifadə
- Oyunçu ilk dəfə 0.00 demo AZN ilə başlayır.
- Admin `/admin` səhifəsində daxil olub birdəfəlik kodlar yaradır.
- Kod oyunçu tərəfindən bir dəfə istifadə ediləndə demo balans artır.
- Oyun nəticəsi serverdə təsadüfi yaradılır; brauzer uduşu özü seçə bilmir.
- Hazırkı demo versiyada uduş yalnız 3 eyni simvol orta sətirdə çıxanda hesablanır.
- Hər simvol üçün vurğu: albalı ×4, limon ×5, üzüm ×6, qarpız ×8, portağal ×10, zəng ×15, brilyant ×25, 7 ×50.

## Vacib
Bu demo prototipidir. İctimai istifadə öncəsi təhlükəsizlik auditi, ehtiyat nüsxə, davamlı disk konfiqurasiyası və hüquqi uyğunluq yoxlanmalıdır.
