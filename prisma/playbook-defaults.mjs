// Default Sales Playbook content (Turkish — the team sells to Turkish restaurants).
// Loaded by the seed script and, in production, on first boot when the table is empty.
// Placeholders: {isletme} {yetkili} {satisci} — filled automatically on a lead's page.
// Note: no prices or numbers are promised here; confirm current plans before quoting.

export const PLAYBOOK_DEFAULTS = [
  // ─── Arama scriptleri ──────────────────────────────────────────────────────
  {
    category: "CALL",
    stage: "NEW",
    title: "Soğuk arama — ilk 30 saniye",
    body: `Satışçı: Merhaba, {isletme} mi? Yetkiliyle görüşebilir miyim?
Satışçı: Merhaba {yetkili}, ben {satisci}, BUYUR'dan arıyorum. Bölgenizdeki restoran ve kafelere dijital QR menü kuruyoruz. 30 saniyenizi alabilir miyim?
Müşteri: Buyurun.
Satışçı: Kısaca soracağım: menüdeki fiyatları değiştirdiğinizde şu an ne yapıyorsunuz — yeniden baskı mı, PDF mi?
(Cevabı sonuna kadar dinle, araya girme. Söylediğini not al.)
Satışçı: Anladım. Bizde fiyatı panelden değiştiriyorsunuz; her masadaki QR menü o anda güncelleniyor, baskı masrafı yok. Kurulum 5 dakika, kredi kartı da istemiyoruz.
Satışçı: Size örnek bir menüyü WhatsApp'tan atayım. Bakınca 10 dakikalık bir demo için sizi arayayım — yarın öğleden önce mi, 15:00'ten sonra mı daha uygun?

İpucu: Sonu her zaman iki seçenekli bir soruyla bitir ("evet/hayır" değil). Görüşme biter bitmez notu ve takip tarihini panele gir.`,
  },
  {
    category: "CALL",
    stage: "CONTACTED",
    title: "Keşif soruları — lead'i nitelendir",
    body: `Amaç: Bu işletme gerçekten ihtiyaç duyuyor mu, karar verici kim, ne zaman?

1. Kaç şubeniz var? Menü tüm şubelerde aynı mı?
2. Fiyatları ne sıklıkla güncelliyorsunuz? En son menü baskısı ne zamandı?
3. Misafirlerinizin ne kadarı yabancı? Hangi diller lazım oluyor?
4. Menünüzü şu an nerede gösteriyorsunuz — basılı, PDF, Instagram, web sitesi?
5. Hangi ürünlerin daha çok ilgi gördüğünü takip ediyor musunuz?
6. Bu kararı siz mi veriyorsunuz, yoksa ortağınızla/işletme sahibiyle mi konuşmalıyız?
7. Ne zamana kadar çözmek istersiniz? (yeni sezon, menü değişikliği, açılış)

Sıcak işaretler: 2+ şube, turist bölgesi, sık fiyat güncellemesi, fiyat sorması → aşamayı "Qualified" yap ve demo iste.`,
  },
  {
    category: "CALL",
    stage: "DEMO_SCHEDULED",
    title: "15 dakikalık demo akışı",
    body: `Hazırlık: Demodan önce işletmenin Instagram'ından 5-6 ürünü panele gir. Demoyu kendi menüleriyle yap.

1. (2 dk) Ağrıyı teyit et: "Geçen görüşmede fiyat güncellemenin dert olduğunu söylemiştiniz, hâlâ öyle mi?"
2. (3 dk) QR'ı müşterinin kendi telefonuyla okut — kendi ürünlerini görsün.
3. (3 dk) Canlı fiyat değişikliği: panelden bir fiyatı değiştir, müşteri telefonunda anında görsün. Demonun "vay" anı budur.
4. (2 dk) Turist varsa: menüyü İngilizce / Arapça / Almanca aç. Kalori & alerjen bilgisini göster.
5. (2 dk) Analitik: hangi ürün açılıyor, hangi masadaki QR taranıyor.
6. (3 dk) Kapanış: "Bugün menünüzü birlikte kuralım mı? QR'ları yarın masalara bırakabilirim."

Demodan sonra: aşamayı "Demo Completed" yap, aynı gün özet mesajını gönder.`,
  },
  {
    category: "CALL",
    stage: "NEGOTIATION",
    title: "Kapanış konuşması",
    body: `Satışçı: {yetkili}, bugüne kadar konuştuklarımızı özetleyeyim: fiyat değişikliklerinde yeniden baskı derdinizi bitirmek, misafirlere birkaç dilde menü sunmak ve hangi ürünün ilgi gördüğünü görmek istiyorsunuz. Doğru mu?
Müşteri: Evet.
Satışçı: O zaman şöyle yapalım: menünüzü bugün birlikte panele girelim, QR'ları masalara ben getireyim. Yarın öğle servisinde misafirleriniz yeni menüyü kullanıyor olur. Salı mı Çarşamba mı kurulum için daha rahat?
(Müşteri tereddüt ederse)
Satışçı: Sizi tutan tek bir şey varsa, o ne? (Dinle, o itirazı çöz — sonra tekrar iki seçenekli soruyu sor.)
Satışçı: Ücretsiz başlayabiliyorsunuz, kredi kartı yok, istediğiniz an bırakabilirsiniz. Risk tamamen bizde.

Kural: Kapanışta yeni özellik anlatma. Sadece müşterinin söylediği 2-3 ihtiyaca bağla.`,
  },
  {
    category: "CALL",
    stage: "NEW",
    title: "Kapıdan ziyaret (saha)",
    body: `Zaman: 10:00–11:30 veya 15:00–17:30. Servis saatlerinde (12–14, 19–21) asla girme.

Satışçı: Merhaba, kolay gelsin! Ben {satisci}, BUYUR'dan. İşletme sahibi ya da müdür burada mı?
Satışçı: Sizi 2 dakikadan fazla tutmayacağım. (Telefonu uzat) Şu QR'ı okutur musunuz? Bu, sizin gibi bir kafenin menüsü.
(Müşteri bakarken)
Satışçı: Fiyatı şuradan değiştirdiğimde — bakın — sizin telefonunuzda da değişti. Baskı yok, PDF yok.
Satışçı: Sizin menünüzle aynısını 5 dakikada kurabiliyorum. Şimdi müsait değilseniz numaranızı alayım, örneği WhatsApp'tan atayım; yarın hangi saatte uğrayayım?

Çıkarken: Lead'i hemen panele gir (kaynak: Cold Outreach), WhatsApp mesajını gönder, takip tarihi koy.`,
  },
  {
    category: "CALL",
    stage: null,
    title: "\"Şu an müsait değilim\" diyene",
    body: `Müşteri: Şu an müsait değilim.
Satışçı: Tamamen anlıyorum, servis saatindesiniz. Size 30 saniyelik kısa bir örnek atayım, uygun bir anınızda bakarsınız. Sizi yarın 11'de mi, 16'da mı arayayım?
Müşteri: 16 olur.
Satışçı: Harika, yarın 16:00'da arıyorum. İyi servisler!

Kural: Asla "ne zaman müsaitsiniz?" diye açık uçlu sorma — her zaman iki somut saat öner. Hemen panelde takip tarihini o saate kur.`,
  },

  // ─── WhatsApp şablonları ───────────────────────────────────────────────────
  {
    category: "WHATSAPP",
    stage: "CONTACTED",
    title: "Görüşme sonrası ilk mesaj",
    body: `Merhaba {yetkili}, az önce telefonda görüştük — ben {satisci}, BUYUR'dan 👋

Konuştuğumuz QR menünün nasıl çalıştığını buradan görebilirsiniz: https://buyur.in

Fiyatı panelden değiştirdiğiniz anda tüm masalardaki menü güncelleniyor, baskı masrafı yok. Yarın 2 dakikalığına arayabilir miyim?`,
  },
  {
    category: "WHATSAPP",
    stage: "CONTACTED",
    title: "Takip — 2-3 gün cevap yoksa",
    body: `Merhaba {yetkili}, {isletme} için konuştuğumuz QR menüye bakma fırsatınız oldu mu?

Uygunsanız bu hafta kendi menünüzle 10 dakikalık bir demo yapalım. Salı mı Perşembe mi daha iyi olur?`,
  },
  {
    category: "WHATSAPP",
    stage: "DEMO_SCHEDULED",
    title: "Demo hatırlatma",
    body: `Merhaba {yetkili}, yarınki BUYUR demomuzu hatırlatmak istedim 🙂

{isletme} menüsünden birkaç ürünü önceden panele ekledim; demoyu kendi menünüzle göreceksiniz. Görüşmek üzere!
— {satisci}`,
  },
  {
    category: "WHATSAPP",
    stage: "DEMO_COMPLETED",
    title: "Demo sonrası özet",
    body: `Bugünkü demo için çok teşekkürler {yetkili}!

Kısaca özet:
✅ Fiyatlar panelden anında güncelleniyor — yeniden baskı yok
✅ Menü 8 dilde (TR, EN, DE, AR, FR, ES, IT, RU)
✅ Hangi ürünün ilgi gördüğünü panelden görüyorsunuz

Kurulumu birlikte 5 dakikada yapabiliriz. Ne zaman başlayalım?`,
  },
  {
    category: "WHATSAPP",
    stage: "WON",
    title: "Hoş geldiniz — yeni müşteri",
    body: `Aramıza hoş geldiniz {yetkili}! 🎉 {isletme} menüsü yayında.

QR'ları masalara yerleştirdikten sonra bir fiyat değişikliği deneyin; anında güncellendiğini göreceksiniz. Takıldığınız her şey için bana buradan yazabilirsiniz.
— {satisci}`,
  },
  {
    category: "WHATSAPP",
    stage: "LOST",
    title: "Yeniden temas — \"şimdi değil\" diyenler",
    body: `Merhaba {yetkili}, bir süre önce {isletme} için QR menüyü konuşmuştuk.

Yeni sezon ya da menü değişikliği öncesi tekrar bakmak isterseniz kurulumu yine 5 dakikada yapabiliyoruz. Kısa bir demo ister misiniz?`,
  },

  // ─── İtiraz karşılama ──────────────────────────────────────────────────────
  {
    category: "OBJECTION",
    stage: "NEGOTIATION",
    title: "\"Fiyatı ne kadar?\" / \"Pahalı\"",
    body: `Fiyat sorusu ilgi işaretidir — önce değeri bağla, sonra rakamı söyle.

Satışçı: Sorduğunuz iyi oldu. Önce şunu sorayım: son menü baskınız ne kadar tuttu, yılda kaç kez bastırıyorsunuz?
(Müşteri hesaplasın — yıllık baskı maliyetini kendisi söylesin.)
Satışçı: Bizde fiyat değişikliği için yeniden baskı yok. Üstelik ücretsiz başlayabiliyorsunuz, kredi kartı istemiyoruz; işinize yaradığını gördükten sonra karar verirsiniz.

Not: Güncel paket fiyatlarını söylemeden önce ekipten teyit et; tahmini rakam verme.`,
  },
  {
    category: "OBJECTION",
    stage: null,
    title: "\"Zaten basılı / PDF menümüz var\"",
    body: `Satışçı: Harika, menünüz hazır demek ki — onu QR'a 5 dakikada aktarıyoruz.
Fark şurada: fiyat değişince yeniden baskı yok, PDF'i tekrar yüklemek yok. Telefonda yakınlaştırmadan okunuyor, ürün fotoğrafları ve 8 dil var.
Basılı menünüzü kaldırmak zorunda da değilsiniz; QR yanında durur, misafir hangisini isterse onu kullanır.`,
  },
  {
    category: "OBJECTION",
    stage: null,
    title: "\"Müşterilerimiz QR okutmuyor\" / \"Yaşlı müşterilerimiz var\"",
    body: `Satışçı: Çok haklı bir nokta. O yüzden basılı menüyü kaldırmanızı önermiyoruz — QR yanında dursun.
Uygulama indirmek gerekmiyor, telefon kamerasıyla açılıyor. Paneldeki analitikte hangi masada ne kadar okutulduğunu görüyorsunuz; kararı tahminle değil, veriyle verirsiniz.
Bir ay deneyin, rakamlara birlikte bakalım.`,
  },
  {
    category: "OBJECTION",
    stage: null,
    title: "\"Şu an vaktim yok, sonra arayın\"",
    body: `Satışçı: Tabii, anlıyorum. Size 30 saniyelik bir özet atayım; yarın 11'de mi 16'da mı arayayım?

Kural: "Sonra" kabul etme — somut saat al ve takip tarihini hemen panele gir. Üçüncü "sonra"dan sonra lead'i "Lost — not ready" olarak kapat, 2-3 ay sonra "yeniden temas" mesajını gönder.`,
  },
  {
    category: "OBJECTION",
    stage: "NEGOTIATION",
    title: "\"Ortağıma / patrona sormam lazım\"",
    body: `Satışçı: Çok doğru, birlikte karar vermeniz önemli. Ortağınız da görsün diye ikiniz için 10 dakikalık bir demo ayarlayalım — ikinizin de müsait olduğu bir saat var mı?
(Olmuyorsa)
Satışçı: O zaman ortağınıza ileteceğiniz 3 maddelik bir özet ve demo videosu atayım. Konuştuktan sonra Perşembe sizi arayayım mı?

Hedef: Karar vericiyi mutlaka demoya dahil et. Karar vericinin adını lead'in kontak bilgisine ekle.`,
  },
  {
    category: "OBJECTION",
    stage: null,
    title: "\"Başka bir firmayla çalışıyoruz\"",
    body: `Satışçı: Güzel, demek ki dijital menünün faydasını biliyorsunuz. Memnun musunuz? En çok neyi seviyorsunuz, neyi değiştirmek isterdiniz?
(Dinle — eksik olanı bul.)
Farklarımızı müşterinin ihtiyacına göre seç: anlık fiyat güncelleme, 8 dil, otomatik işletme sayfası (isletmeniz.buyur.in), ürün ve QR analitiği, 5 dakikada kurulum.

Kural: Rakip firmayı asla kötüleme. Sözleşme bitiş tarihini öğren ve o tarihten 1 ay öncesine takip koy.`,
  },
  {
    category: "OBJECTION",
    stage: null,
    title: "\"Teknolojiyle aram yok, bize göre değil\"",
    body: `Satışçı: Tam da bu yüzden kurulumu biz yapıyoruz. Sizin tek yapacağınız, fiyat değiştirmek istediğinizde telefondan bir sayıyı değiştirmek — WhatsApp mesajı yazmak kadar kolay.
İsterseniz şimdi bir ürünün fiyatını siz değiştirin, ne kadar kolay olduğunu kendiniz görün.`,
  },

  // ─── Başarılı satış stratejileri ───────────────────────────────────────────
  {
    category: "STRATEGY",
    stage: null,
    title: "Doğru saatte iletişim",
    body: `• En iyi arama saatleri: 10:00–11:30 ve 15:00–17:30.
• Asla servis saatinde arama: 12:00–14:00 ve 19:00–21:00.
• Pazartesi birçok restoran kapalı ya da yoğun hazırlık günü; ilk temas için Salı–Perşembe daha verimli.
• WhatsApp mesajlarını sabah 10–11 arası gönder; akşam servisi sırasında gelen mesaj kaybolur.`,
  },
  {
    category: "STRATEGY",
    stage: null,
    title: "Takip ritmi: 0-1-3-7-14",
    body: `Çoğu satış ilk temasta değil, takipte kapanır.

• Gün 0: Görüşme + aynı gün WhatsApp özeti
• Gün 1: Kısa telefon (örneğe baktı mı?)
• Gün 3: Değer mesajı (ilgili bir özellik ya da müşteri hikâyesi)
• Gün 7: Demo teklifi, iki seçenekli saat
• Gün 14: "Son mesaj" — kibarca kapı arala

5 temastan sonra yanıt yoksa lead'i "Lost" yap, sebebini yaz ve 2-3 ay sonraya yeniden temas takibi koy. Panelde takip tarihi olmayan açık lead kalmasın.`,
  },
  {
    category: "STRATEGY",
    stage: null,
    title: "Önce sıcak lead'ler",
    body: `Her sabah My Day ekranında önce Overdue, sonra Today listesini sıfırla.

Öncelik sırası:
1. Lead score 60+ olanlar
2. 2+ şubeli işletmeler (tek satışta birden fazla şube)
3. Turist bölgeleri (8 dil argümanı güçlü)
4. Fiyat / teklif soranlar
5. 3+ gündür dokunulmamış açık lead'ler ("Needs attention")`,
  },
  {
    category: "STRATEGY",
    stage: "DEMO_SCHEDULED",
    title: "Demoyu kendi menüleriyle yap",
    body: `Genel demo yerine kişiselleştirilmiş demo yap:
• Instagram veya Google'dan 5-6 ürünü ve gerçek fiyatlarını panele gir.
• Müşteriye QR'ı kendi telefonuyla okut.
• Panelden bir fiyatı canlı değiştir — kendi ürününün kendi telefonunda değiştiğini görmesi en ikna edici an.
• Demo bitmeden kurulum tarihini iste.`,
  },
  {
    category: "STRATEGY",
    stage: null,
    title: "Fiyat güncelleme derdini konuştur",
    body: `Türkiye'de menü fiyatları sık değişiyor; bu, en güçlü konuşma başlangıcımız.

Sorular:
• "En son ne zaman fiyat güncellediniz?"
• "Bu yıl kaç kez menü bastırdınız?"
• "Fiyat değişince eski menüler masada kalıyor mu?"

Müşteri sorunu kendi ağzıyla söylesin; çözümü ondan sonra göster.`,
  },
  {
    category: "STRATEGY",
    stage: null,
    title: "Turist bölgelerinde dil argümanı",
    body: `Sultanahmet, Beyoğlu, Kaleiçi, Bodrum, Alsancak, Kapadokya gibi bölgelerde ilk cümle dil olsun:
"Yabancı misafirleriniz menüyü kendi dillerinde okusa garsonlarınızın çeviri yükü azalır."

BUYUR menüsü 8 dilde: TR · EN · DE · AR · FR · ES · IT · RU. Kalori ve alerjen bilgisi de turist misafirler için ayrıca değerli.`,
  },
  {
    category: "STRATEGY",
    stage: "WON",
    title: "Referans ve sosyal kanıt",
    body: `• Kazanılan her müşteriden kurulumdan 2 hafta sonra 1 referans iste: "Sizin gibi memnun kalacağını düşündüğünüz bir komşu işletme var mı?"
• Referansla gelen lead'i kaynak "Referral" ile aç — dönüşüm oranını Funnel ekranında takip ederiz.
• Aynı semtteki müşterilerin adını (izinleriyle) konuşmada kullan: "Az ileride X de kullanıyor."`,
  },
  {
    category: "STRATEGY",
    stage: null,
    title: "Her görüşmeden sonra 30 saniye kuralı",
    body: `Telefonu kapattıktan sonra 30 saniye içinde panele gir:
1. Not ekle (ne konuşuldu, itiraz neydi)
2. Aşamayı güncelle
3. Bir sonraki takip tarihini koy

Panelde kayıt yoksa görüşme yapılmamış sayılır. Dashboard, Funnel ve kampanya raporları bu kayıtlardan hesaplanıyor.`,
  },
];

export async function ensurePlaybook(prisma) {
  const count = await prisma.playbookEntry.count();
  if (count > 0) return 0;
  await prisma.playbookEntry.createMany({
    data: PLAYBOOK_DEFAULTS.map((e, i) => ({ ...e, sortOrder: i })),
  });
  return PLAYBOOK_DEFAULTS.length;
}
