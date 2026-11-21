# 555 KAZINO — virtual arcade demo

Mobil uyğun qara-qızılı giriş səhifəsi, ayrıca admin girişi, birdəfəlik istifadəçi kodları və 5×3 meyvə arcade lövhəsi.

**Vacib:** Bu layihə yalnız virtual xallı, mərcsiz əyləncə demosudur. Xalların pul dəyəri yoxdur; pul yatırma, mərc, uduşun nağdlaşdırılması və pul çıxarışı yoxdur.

## Lokal işə salmaq
1. Node.js 20 və ya daha yenisini quraşdırın.
2. `npm install`
3. `.env.example` faylını `.env` adı ilə köçürün və `SESSION_SECRET` (ən azı 32 simvol) və `ADMIN_PASSWORD` (ən azı 12 simvol) dəyərlərini özünüz seçin.
4. `npm start`
5. Brauzerdə `http://localhost:3000` açın. Admin: `http://localhost:3000/admin`.

## GitHub + Render
1. ZIP-i açın və bütün faylları GitHub repozitoriyasının kökünə yükləyin.
2. Render-də **New + → Web Service** seçib repozitoriyanı qoşun.
3. Build command: `npm install`; Start command: `npm start`.
4. Render Environment-də `SESSION_SECRET` və `ADMIN_PASSWORD` əlavə edin. Şifrələri heç vaxt GitHub-a yükləməyin.
5. `render.yaml` persistent disk konfiqurasiyasını göstərir. SQLite faylları `/var/data` altında saxlanılır.

## Sınaq
- Admin paneli: `/admin` (admin şifrəsi `.env`/Render Environment-də təyin olunur).
- Admin panelindən xal təyin edilmiş giriş kodu yaradın.
- Ana səhifədə həmin kodla daxil olun.

## Təhlükəsizlik qeydləri
Admin şifrəsi repozitoriyada saxlanmır. Sessiyalar serverdə saxlanılır, giriş cəhdləri limitlənir, kodlar bazada SHA-256 heşi ilə saxlanır. Render-də persistent disk qoşulmalıdır ki, SQLite məlumatları deploy-lar arasında qalsın.
