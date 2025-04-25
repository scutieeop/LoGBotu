# Log Bot Yapılandırma Klasörü

Bu klasör, bot için gerekli tüm yapılandırma dosyalarını içerir. Tüm ayarlar JSON formatında tutulmaktadır.

## Dosyalar

### guild.json
Sunucu kimlik bilgilerini ve bot token'ını içerir:
- `TOKEN`: Discord bot token'ı
- `CLIENT_ID`: Bot client ID'si
- `LOG_CHANNEL_ID`: Ana log kanalı ID'si
- `GUILD_ID`: Sunucu ID'si

### config.json
Ana bot yapılandırmasını içerir:
- Log kanal ve webhook ID'leri
- Renk kodları
- Embed ayarları
- Etkinleştirilmiş log türleri
- Özel log ayarları

### webhook-urls.json
Discord webhook URL'lerini içerir:
- Bot tarafından logsistemikur komutu ile oluşturulan webhook'ların tam URL'leri
- Bu URL'ler discord.js tarafından webhook'lara bağlanmak için kullanılır
- **Önemli**: Bu dosya gizli bilgiler içerir, başkalarıyla paylaşmayın!

### commands.json
Komut yapılandırmalarını içerir:
- `prefix`: Komut öneki (örn: `.`)
- `usePrefix`: Prefix komutlarının aktif olup olmadığı
- `defaultPermissions`: Varsayılan izinler
- `adminRoles`: Yönetici rol ID'leri
- `modRoles`: Moderatör rol ID'leri
- `disabledCommands`: Devre dışı bırakılmış komutlar
- `cooldowns`: Komut kullanım süreleri

## Webhook Sistemi

### Webhooks Nasıl Oluşturulur?
1. `.logsistemikur` komutunu kullanın (yönetici yetkisi gerekir)
2. Bu komut otomatik olarak:
   - Log kategorisi ve kanalları oluşturur
   - Her kanal için webhook oluşturur
   - Webhook URL'lerini `webhook-urls.json` dosyasına kaydeder
   - Webhook URL'leri bot başlatıldığında otomatik olarak yüklenir

### Manuel Webhook Güncellemesi
Eğer webhook'ları manuel olarak değiştirmek isterseniz:
1. Discord'da webhook URL'sini kopyalayın
2. `webhook-urls.json` dosyasındaki ilgili webhook değerini güncelleyin:

```json
{
  "webhooks": {
    "message-logs": "https://discord.com/api/webhooks/123456789/your-token",
    "member-logs": "https://discord.com/api/webhooks/987654321/another-token"
  }
}
```

## Dosya Düzenleme

Bu dosyaları düzenlerken dikkat edilmesi gerekenler:
1. JSON sözdizimi kurallarına uyun (virgüller, tırnak işaretleri)
2. `guild.json` ve `webhook-urls.json` içindeki gizli bilgileri başkalarıyla paylaşmayın
3. Bu dosyalar bot başlangıcında otomatik olarak yüklenir

## Örnekler

### Yeni bir komut sınırlaması eklemek için:
```json
{
  "cooldowns": {
    "default": 3,
    "yenikomut": 15
  }
}
```

### Webhook değiştirmek için:
```json
{
  "webhooks": {
    "message-logs": "YENI_WEBHOOK_URL",
  }
}
``` 