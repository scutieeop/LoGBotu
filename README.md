# Discord.js v14 Ayrıntılı Log Botu

Bu bot, Discord sunucunuzdaki her türlü etkinliği ayrıntılı bir şekilde izleyen ve kaydeden bir log botudur. Bu bot, özel `guild_fonksiyonAdi` formatında fonksiyonlar kullanarak, sunucunuzdaki en küçük değişiklikleri bile yakalar.

## Özellikler

- 🔍 **Aşırı detaylı loglama**: Sunucudaki neredeyse her türlü etkinliği loglar
- 📝 **Mesaj logları**: Mesaj gönderme, silme, düzenleme işlemleri
- 👤 **Üye logları**: Sunucuya giriş, çıkış, yasaklama, atılma
- 🔊 **Ses logları**: Ses kanalına katılma, ayrılma, ses durumu değişiklikleri
- 📂 **Kanal logları**: Kanal oluşturma, silme, düzenleme
- 👑 **Rol logları**: Rol oluşturma, silme, düzenleme
- 🖼️ **Emoji logları**: Emoji ekleme, silme, güncelleme
- 🔗 **Davet logları**: Davet oluşturma, silme, kullanım
- ⚙️ **Webhook logları**: Webhook oluşturma, silme, kullanım
- 📋 **İzin değişiklikleri**: Kanallar ve roller için izin değişiklikleri
- 📊 **Detaylı bilgiler**: Her log için detaylı ve ayrıntılı bilgiler
- 🎨 **Renkli embed'ler**: İşlem tipine göre renkli bildirimler

## Kurulum

1. Bot için gerekli paketleri yükleyin:
```bash
npm install
```

2. `guild.config.js` dosyasını düzenleyerek bot bilgilerini ekleyin:
```javascript
module.exports = {
  TOKEN: "your_discord_bot_token_here",
  CLIENT_ID: "your_client_id_here",
  LOG_CHANNEL_ID: "your_log_channel_id",
  GUILD_ID: "your_guild_id"
};
```

3. Botu başlatın:
```bash
npm start
```

## Özel Fonksiyonlar

Bot, `guild_fonksiyonAdi` formatında özel fonksiyonlar kullanır. Örneğin:

- `guild_sendLogEmbed`: Log gönderme fonksiyonu
- `guild_formatUser`: Kullanıcı bilgilerini formatlama
- `guild_formatMember`: Üye bilgilerini formatlama
- `guild_formatMessage`: Mesaj bilgilerini formatlama
- `guild_getDifferences`: Mesaj değişikliklerini bulma
- `guild_calculateRiskLevel`: Kullanıcı risk seviyesini hesaplama
- `guild_getVoiceChangeType`: Ses durumu değişikliklerini belirleme

## Yapılandırma

`config/config.js` dosyasından aşağıdaki ayarları değiştirebilirsiniz:

- Log kanalı ID'si
- Sunucu ID'si
- Embed renkleri
- Embed altbilgisi
- Log tipleri (hangi tür olayların loglanacağı)

## Lisans

MIT 