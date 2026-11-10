import { Project, GalleryItem, Sponsor, ExpoCompany, ExpoScheduleItem, NewsItem, PressItem } from "../types";

export const PROJECTS_DATA: Project[] = [];

export const GALLERY_ITEMS: GalleryItem[] = [];

export const SPONSORS_DATA: Sponsor[] = [];

export const EXPO_COMPANIES: ExpoCompany[] = [];

export const EXPO_SCHEDULE: ExpoScheduleItem[] = [
  { time: '09:30 - 10:30', title: 'Açılış Protokolü & SARGE EXPO Açılış Kurdelesi', speaker: 'KTÜ Rektörü & TSK Temsilcileri', company: 'KTÜ & SARGE', location: 'Ana Salon' },
  { time: '10:45 - 11:45', title: 'Savunma Sanayiinde Yerlileşme ve İnsansız Sistemlerin Geleceği', speaker: 'Dr. Ahmet Özkan', company: 'ASELSAN Genel Müd. Yrd.', location: 'Salon A' },
  { time: '13:00 - 14:15', title: 'Milli Muharip Uçak KAAN ve Genç Mühendislerin Rolü', speaker: 'Müh. Selim Yıldız', company: 'TUSAŞ Kıdemli Mühendisi', location: 'Salon A' },
  { time: '14:30 - 15:30', title: 'Öğrenci Projeleri Sunumu & Hakem Değerlendirmeleri', speaker: 'SARGE Takım Kaptanları', company: 'KTÜ SARGE', location: 'Fuar Sahnesi' },
  { time: '15:45 - 17:00', title: 'Savunma Sanayiinde Kariyer & Staj İmkânları Paneli', speaker: 'İnsan Kaynakları Direktörleri', company: 'HAVELSAN & ROKETSAN', location: 'Salon B' }
];

export const PRESS_DATA: PressItem[] = [
  {
    id: 'press-1',
    title: "KTÜ SARGE Takımı TEKNOFEST Jet Motoru Tasarımı Yarışması'nda 'En Özgün Tasarım' Ödülünü Kazandı",
    source: 'Anadolu Ajansı',
    sourceUrl: 'https://www.aa.com.tr',
    imageUrl: 'https://images.unsplash.com/photo-1541185933-ef5d8ed016c2?auto=format&fit=crop&w=1200&q=80',
    date: '24 Eylül 2026',
    category: 'Ulusal Basın',
    summary: "Karadeniz Teknik Üniversitesi Savunma ve Ar-Ge Topluluğu bünyesindeki SARJET ekibi, TEKNOFEST Havacılık ve Uzay Festivali kapsamında milli turbojet motoru projesiyle jüriden tam not alarak 'Özgün Tasarım Ödülü'ne layık görüldü.",
    content: "TEKNOFEST kapsamında düzenlenen yarışmada KTÜ öğrencileri tarafından sıfırdan geliştirilen mikro turbojet motoru, aerodinamik yapısı, yanma odası verimliliği ve yerli malzeme kullanımı ile dikkat çekti. Takım kaptanı, hedeflerinin İHA'lara güç verecek tamamen yerli bir itki sistemi üretmek olduğunu belirtti."
  },
  {
    id: 'press-2',
    title: "Trabzon'da Savunma Sanayii Zirvesi: SARGE EXPO Bölgenin En Büyük Teknoloji Fuarına Ev Sahipliği Yaptı",
    source: 'TRT Haber',
    sourceUrl: 'https://www.trthaber.com',
    imageUrl: 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1200&q=80',
    date: '18 Mayıs 2026',
    category: 'Televizyon & Röportaj',
    summary: "KTÜ Osman Turan Kongre Merkezi'nde düzenlenen SARGE EXPO, savunma sanayiinin öncü firmaları ASELSAN, TUSAŞ, ROKETSAN ve HAVELSAN temsilcilerini binlerce genç mühendis adayı ile bir araya getirdi.",
    content: "İki gün boyunca süren fuarda, öğrenci projeleri sergilendi, savunma sanayii devleriyle birebir iş ve staj mülakatları gerçekleştirildi. Etkinlik boyunca Karadeniz bölgesinin mühendislik potansiyeli ve Ar-Ge yatırımları ele alındı."
  },
  {
    id: 'press-3',
    title: "GÖKÇEN Yüksek İrtifa Roketi Aksaray Atış Alanında Hedefe Ulaştı",
    source: 'Demirören Haber Ajansı',
    sourceUrl: 'https://www.dha.com.tr',
    imageUrl: 'https://images.unsplash.com/photo-1517976487507-5b3b4b45f922?auto=format&fit=crop&w=1200&q=80',
    date: '12 Ağustos 2026',
    category: 'Ulusal Basın',
    summary: "KTÜ SARGE Roket Takımı tarafından tasarlanan çift kademeli paraşüt kurtarma sistemine sahip araştırma roketi, Roketsan Hisar Atış Alanı'nda başarılı fırlatma ve faydalı yük bırakma testini tamamladı.",
    content: "Milli imkânlarla üretilen aviyonik uçuş bilgisayarı ve kompozit gövde yapısıyla zorlu meteorolojik koşullara rağmen hedef irtifaya ulaşan roket, fırlatma sonrasında güvenli şekilde yeryüzüne indirildi."
  },
  {
    id: 'press-4',
    title: "ALACA Savaşan İHA Otonom İt Dalaşı ve Hedef Takip Görevlerinde Finalde",
    source: 'Hürriyet Teknoloji',
    sourceUrl: 'https://www.hurriyet.com.tr',
    imageUrl: 'https://images.unsplash.com/photo-1508614589041-895b88991e3e?auto=format&fit=crop&w=1200&q=80',
    date: '05 Eylül 2026',
    category: 'Teknoloji Medyası',
    summary: "Gelişmiş yapay zekâ görüntü işleme algoritmaları ve gömülü otopilot yazılımı ile rakip İHA'ları otomatik kilitlenme ile takip eden ALACA İHA, TEKNOFEST finallerinde göz doldurdu.",
    content: "Tamamen öğrenciler tarafından geliştirilen derin öğrenme modelleri sayesinde düşük gecikmeyle hedef tespiti ve kilitlenme gerçekleştiren ALACA, yerli yazılım mimarisiyle takdir topladı."
  }
];

export const NEWS_DATA: NewsItem[] = [
  {
    id: 'n-1',
    date: '10 Ağustos 2026',
    title: 'SARGE EXPO 2026 Tamamlandı, EXPO 2027 Başvuruları Başladı!',
    summary: 'SARGE EXPO 2026 coşkuyla tamamlandı. Doğu Karadeniz\'in en büyük öğrenci tabanlı savunma sanayii fuarı olan SARGE EXPO 2027 için firma stant katılımı ve öğrenci görev başvuruları başladı.',
    badge: 'EXPO 2027'
  },
  {
    id: 'n-2',
    date: '28 Ocak 2026',
    title: 'SARGE Havacılık Takımları TEKNOFEST 2026 Hazırlıklarına Hız Kesmeden Devam Ediyor',
    summary: 'İHA Takımlarımız atölye imalat ve test uçuşlarına devam ediyor.',
    badge: 'Havacılık'
  },
  {
    id: 'n-3',
    date: '15 Ocak 2026',
    title: 'KTÜ Mühendislik Fakültesi Atölyemize Yeni CNC Ve 3D Yazıcı Altyapısı Eklendi',
    summary: 'Rektörlüğümüz desteğiyle atölyemize 5 eksenli hassas imalat tezgahı kazandırıldı.',
    badge: 'Atölye'
  }
];

export const CLUB_STATS = [
  { label: 'Kuruluş Yılı', value: '2018', icon: 'Calendar' },
  { label: 'Aktif Mühendis Adayı Üye', value: '280+', icon: 'Users' },
  { label: 'Geliştirilen Proje Sayısı', value: '10+', icon: 'Rocket' },
  { label: 'Uzmanlık Takımı', value: '4', icon: 'Shield' },
  { label: 'SARGE EXPO Katılımcısı', value: '8.000+', icon: 'Building2' }
];

export const MILESTONES = [];
