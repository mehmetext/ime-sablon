# KTÜN İME Haftalık Belge Şablonu

Karadeniz Teknik Üniversitesi **İşletmede Mesleki Eğitim (İME)** sürecinde kullanılmak üzere haftalık çalışma kayıtlarını A4 formata uygun şekilde hazırlayan web tabanlı şablon oluşturucu.

Word veya Google Docs’tan yapıştırılan metinleri düzenleyebilir, otomatik sayfa bölümü ile önizleyebilir ve yazdırarak PDF olarak kaydedebilirsiniz.

## Özellikler

- **A4 önizleme** — Üst bilgi (işletme adı, sayfa numarası) ve alt bilgi (çalışma tarihi, onaylayan, imza/mühür) alanlarıyla baskıya hazır sayfa düzeni
- **Otomatik sayfalama** — Uzun metinler içerik alanına göre birden fazla sayfaya bölünür
- **Zengin metin editörü** — Başlık, kalın/italik/altı çizili, listeler, kod bloğu ve hizalama (TipTap)
- **Word / Office yapıştırma** — MS Office HTML’i temizlenerek biçim korunur
- **Çoklu çalışma maddesi** — Her hafta veya kayıt için ayrı madde; sıralama, ekleme ve silme
- **Tarih modları**
  - **Manuel** — Her madde için serbest tarih metni
  - **Otomatik (haftalık)** — Başlangıç tarihinden itibaren her madde bir sonraki hafta; tarih **Pazartesi–Cuma** aralığı olarak gösterilir
- **Yerel kayıt** — Form verileri tarayıcıda (`localStorage`) otomatik saklanır
- **Yazdır / PDF** — Tarayıcının yazdırma iletişim kutusu üzerinden PDF’e kaydetme

## Gereksinimler

- [Node.js](https://nodejs.org/) 18 veya üzeri (önerilir: LTS)
- npm (Node ile birlikte gelir)

## Kurulum ve çalıştırma

```bash
# Bağımlılıkları yükle
npm install

# Geliştirme sunucusu (varsayılan: http://localhost:5173)
npm run dev

# Üretim derlemesi
npm run build

# Derlenmiş sürümü yerel önizleme
npm run preview
```

## Kullanım

1. Sol panelde **İşletmenin Adı** ve **Onaylayanın Adı-Soyadı** alanlarını doldurun.
2. **Tarih Modu**nu seçin:
   - Haftalık kayıt tutuyorsanız **Otomatik (haftalık)** ve bir **Başlangıç Tarihi** (genelde o haftanın Pazartesi’si) belirleyin.
   - Esnek tarih gerekiyorsa **Manuel** modda her maddenin tarihini ayrı girin.
3. **Çalışmalar** listesinden madde seçin veya **Yeni** ile madde ekleyin.
4. **İçerik** alanında haftalık çalışma metnini yazın veya Word / Google Docs’tan yapıştırın.
5. Sağdaki A4 önizlemesini kontrol edin; gerekirse maddeleri yukarı/aşağı ok ile sıralayın.
6. **Yazdır / PDF** ile çıktı alın; hedef olarak “PDF olarak kaydet” seçebilirsiniz.

> Veriler yalnızca kullandığınız tarayıcıda saklanır. Farklı cihaz veya tarayıcıda otomatik senkronize olmaz.

## Proje yapısı

```
ime-sablon/
├── index.html          # Giriş HTML
├── app.js              # React kök bileşeni
├── styles.css          # Arayüz, A4 sayfa ve yazdırma stilleri
├── src/
│   └── App.jsx         # Ana uygulama, editör, sayfalama mantığı
├── vite.config.js
└── package.json
```

## Teknolojiler

| Alan | Kütüphane |
|------|-----------|
| Arayüz | React 19 |
| Derleme | Vite 7 |
| Zengin metin | TipTap 3 (`@tiptap/react`, Starter Kit, Text Align, Underline) |

## Lisans

Bu depo için ayrı bir lisans dosyası tanımlanmamıştır. Kullanım ve paylaşım koşulları proje sahibiyle netleştirilmelidir.
