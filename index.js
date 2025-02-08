require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const { VK } = require("vk-io");
const sqlite3 = require("sqlite3").verbose();
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const { createCanvas, loadImage } = require("canvas");
const { exec } = require('child_process');
const os = require('os');
const moment = require('moment');

const allowedAdmins = [1364548192];  // Массив с ID пользователей, которым разрешено использовать команду

// Подключение к БД
const db = new sqlite3.Database("tracking.db", (err) => {
  if (err) console.error("Ошибка подключения к БД:", err.message);
  else console.log("✅ Подключено к базе данных SQLite.");
});

console.log('-----> VK шпион V1.3 <-----');

const chatId = process.env.ADMIN_CHAT_ID;
if (!chatId) {
  console.error('Admin chat ID is missing or invalid');
  return;
}


// Создание таблиц
db.run(`CREATE TABLE IF NOT EXISTS tracked_users (id INTEGER PRIMARY KEY AUTOINCREMENT, vk_id TEXT UNIQUE NOT NULL)`);
db.run(`CREATE TABLE IF NOT EXISTS user_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, vk_id TEXT, action TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)`);
db.run(`CREATE TABLE IF NOT EXISTS tracking_settings (vk_id TEXT UNIQUE NOT NULL, notify_friends BOOLEAN DEFAULT 1, notify_name BOOLEAN DEFAULT 1, notify_avatar BOOLEAN DEFAULT 1, notify_city BOOLEAN DEFAULT 1, notify_verified BOOLEAN DEFAULT 1, notify_last_seen BOOLEAN DEFAULT 1, notify_status BOOLEAN DEFAULT 1, notify_link BOOLEAN DEFAULT 1)`);

// Инициализация ботов
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
const vk = new VK({ token: process.env.VK_ACCESS_TOKEN });

// 📌 Команда /start (Приветствие)
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, `👋 Привет, ${msg.from.first_name}!
Я бот для отслеживания изменений профилей ВКонтакте. Version 1.3

📝 Используйте /help для просмотра доступных команд.`);
});

// 📌 Команда /help (Список команд)
bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
  
    function escapeMarkdown(text) {
      return text.replace(/([_*[\]()~`>#+\-=|{}.!])/g, "\\$1");
    }
  
    const helpMessage = `
    🤖 *Доступные команды:*
    📌 /start - ${escapeMarkdown("Приветствие и информация о боте")}
    📌 /help - ${escapeMarkdown("Список команд")}
    📌 /track <id> - ${escapeMarkdown("Добавить пользователя в отслеживание")}
    📌 /profile <id> - ${escapeMarkdown("Информация о профиле VK")}
    📌 /gprofile <id> - ${escapeMarkdown("Информация о группе VK")}
    📌 /info <id> - ${escapeMarkdown("Получить информацию о профиле в html")}
    📌 /photo <id> - ${escapeMarkdown("Получить информацию о профиле в картинке")}
    📌 /друзья <id> - ${escapeMarkdown("Получить информацию о друзьях")}
    📌 /подписчики <id> - ${escapeMarkdown("Получить информацию о подписчиках")}
    📌 /подписки <id> - ${escapeMarkdown("Получить информацию о подписчиках")}
    📌 /settings - ${escapeMarkdown("Настройки бота")}
    📌 /update - ${escapeMarkdown("Информация об обновлении")}
    💡 ${escapeMarkdown("Введите команду и следуйте инструкциям.")} 
    `;
  
    bot.sendMessage(chatId, helpMessage, { parse_mode: "Markdown" });
  });

// 📌 Команда /profile <VK_ID> (Просмотр информации о профиле)
bot.onText(/\/profile (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  let vkId = match[1];

  // Если введена ссылка на профиль, извлекаем ID
  if (vkId.includes("vk.com/")) {
    const urlParts = vkId.split("/");
    vkId = urlParts[urlParts.length - 1]; // Берем последнее значение после слэша
  }

  try {
    const response = await vk.api.users.get({
      user_ids: vkId,
      fields: "photo_max_orig,city,verified,last_seen,status,online,sex,bdate,about,counters,has_mobile,blacklisted,site,relation,relation_partner,is_closed,career,military,photo_id,is_premium,wall_comments"
    });

    if (!response.length) return bot.sendMessage(chatId, "❌ Профиль не найден.");

    const user = response[0];
    const lastSeen = user.last_seen ? new Date(user.last_seen.time * 1000).toLocaleString() : "Неизвестно";
    const city = user.city ? user.city.title : "Не указан";
    const verified = user.verified ? "✅ Да" : "❌ Нет";
    const status = user.status || "Отсутствует";
    const online = user.online ? "🟢 Онлайн" : "🔴 Офлайн";
    const sex = user.sex === 1 ? "👩 Женщина" : user.sex === 2 ? "👨 Мужчина" : "Не указано";
    const bdate = user.bdate || "Не указана";
    const about = user.about || "Нет описания";
    const friendsCount = user.counters?.friends || 0;
    const followersCount = user.counters?.followers || 0;
    const photosCount = user.counters?.photos || 0;
    const videosCount = user.counters?.videos || 0;
    const giftsCount = user.counters?.gifts || 0;
    const wallPostsCount = user.counters?.posts || 0;
    const hasMobile = user.has_mobile ? "📱 Привязан" : "❌ Не привязан";
    const blacklisted = user.blacklisted ? "🚫 В ЧС у пользователя" : "✅ Нет";
    const site = user.site ? user.site : "❌ Не указан";
    const isClosed = user.is_closed ? "🔒 Закрытый профиль" : "🌍 Открытый профиль";
    const isPremium = user.is_premium ? "💎 VK Premium" : "❌ Нет";
    const wallComments = user.wall_comments ? "✅ Разрешены" : "❌ Запрещены";

    // Определение знака зодиака
    function getZodiacSign(date) {
      if (!date) return "Не указан";
      const [day, month] = date.split(".").map(Number);
      const zodiacSigns = [
        "♑ Козерог", "♒ Водолей", "♓ Рыбы", "♈ Овен", "♉ Телец", "♊ Близнецы",
        "♋ Рак", "♌ Лев", "♍ Дева", "♎ Весы", "♏ Скорпион", "♐ Стрелец"
      ];
      const zodiacDates = [20, 19, 20, 20, 21, 21, 22, 22, 22, 23, 23, 21];
      return day > zodiacDates[month - 1] ? zodiacSigns[month] : zodiacSigns[month - 1];
    }

    const zodiacSign = getZodiacSign(user.bdate);

    // Определение отношений
    const relationTypes = [
      "Не указано", "❣️ Влюблен(а)", "💍 Помолвлен(а)", "💑 В отношениях",
      "❤️ Женат/Замужем", "💔 Все сложно", "💔 В активном поиске", "🚫 Не в отношениях"
    ];
    let relation = relationTypes[user.relation] || "Не указано";
    if (user.relation_partner) {
      relation += ` с [${user.relation_partner.first_name} ${user.relation_partner.last_name}](https://vk.com/id${user.relation_partner.id})`;
    }

    // Определение устройства (ПК или телефон)
    const device = user.last_seen?.platform ? (user.last_seen.platform > 6 ? "📱 Телефон" : "💻 Компьютер") : "❓ Неизвестно";

    // Экранирование специальных символов для Markdown
    function escapeMarkdown(text) {
      return text.replace(/([_*[\]()~`>#+\-=|{}.!])/g, "\\$1");
    }

    const profileInfo = `
👤 *Профиль VK:* [${escapeMarkdown(user.first_name)} ${escapeMarkdown(user.last_name)}](https://vk.com/id${vkId})
🏙 *Город:* ${escapeMarkdown(city)}
🔹 *Верифицирован:* ${verified}
⏳ *Последний вход:* ${escapeMarkdown(lastSeen)}
📱 *Устройство:* ${device}
🏷 *Статус:* ${escapeMarkdown(status)}
🔵 *Онлайн:* ${online}
👥 *Пол:* ${sex}
🎂 *Дата рождения:* ${bdate} (${zodiacSign})
📅 *Дата регистрации:* Неизвестно (API не предоставляет)
📱 *Привязан телефон:* ${hasMobile}
🔑 *Подтверждение входа:* ${hasMobile}
📧 *Привязана почта:* ${hasMobile}
🚫 *Черный список:* ${blacklisted}
🔗 *Сайт:* ${site}
🛡 *VK Premium:* ${isPremium}
🔒 *Приватность профиля:* ${isClosed}
💬 *Комментарии на стене:* ${wallComments}
❤️ *Отношения:* ${relation}
🎥 *Видео:* ${videosCount}
📸 *Фотографии:* ${photosCount}
🎁 *Подарки:* ${giftsCount}
📝 *Записи на стене:* ${wallPostsCount}
👫 *Друзья:* ${friendsCount}
👥 *Подписчики:* ${followersCount}
📸 *Аватар:*`;

    // Отправка аватара как фото
    bot.sendPhoto(chatId, user.photo_max_orig, {
      caption: profileInfo, 
      parse_mode: "Markdown"
    });

  } catch (error) {
    bot.sendMessage(chatId, "⚠ Ошибка при получении данных профиля.");
  }
});

bot.onText(/\/gprofile (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  let groupId = match[1];

  // Если введена ссылка на сообщество, извлекаем ID
  if (groupId.includes("vk.com/")) {
    const urlParts = groupId.split("/");
    groupId = urlParts[urlParts.length - 1]; // Берем последнее значение после слэша
  }

  // Проверка на пустое значение groupId
  if (!groupId) {
    return bot.sendMessage(chatId, "❌ Пожалуйста, укажите правильный ID или ссылку на сообщество.");
  }

  try {
    const response = await vk.api.groups.getById({
      group_ids: groupId, // Убедитесь, что здесь передается корректный ID
      fields: "photo_200,city,description,counters,verified,cover,website,wall_comments"
    });

    if (!response.length) {
      return bot.sendMessage(chatId, "❌ Сообщество не найдено. Проверьте правильность ID или ссылки.");
    }

    const group = response[0];
    const city = group.city ? group.city.title : "Не указан";
    const verified = group.verified ? "✅ Да" : "❌ Нет";
    const description = group.description || "Нет описания";
    const membersCount = group.counters?.members || 0;
    const photosCount = group.counters?.photos || 0;
    const videosCount = group.counters?.videos || 0;
    const postsCount = group.counters?.posts || 0;
    const website = group.website || "❌ Не указан";
    const wallComments = group.wall_comments ? "✅ Разрешены" : "❌ Запрещены";

    // Экранирование специальных символов для Markdown
    function escapeMarkdown(text) {
      return text.replace(/([_*[\]()~`>#+\-=|{}.!])/g, "\\$1");
    }

    const groupInfo = `
👥 *Сообщество:* [${escapeMarkdown(group.name)}](https://vk.com/${groupId})
🏙 *Город:* ${escapeMarkdown(city)}
🔹 *Верифицировано:* ${verified}
📜 *Описание:* ${escapeMarkdown(description)}
🔗 *Вебсайт:* ${website}
💬 *Комментарии на стене:* ${wallComments}
📸 *Фотографии:* ${photosCount}
🎥 *Видео:* ${videosCount}
📝 *Записи на стене:* ${postsCount}
👥 *Участников:* ${membersCount}
🖼 *Обложка:*`;

    // Если есть обложка, отправляем её
    if (group.cover) {
      bot.sendPhoto(chatId, group.cover?.src, {
        caption: groupInfo,
        parse_mode: "Markdown"
      });
    } else {
      bot.sendMessage(chatId, groupInfo, { parse_mode: "Markdown" });
    }

  } catch (error) {
    console.error(error); // Для отладки
    bot.sendMessage(chatId, "⚠ Ошибка при получении данных о сообществе. Проверьте правильность ID и наличие доступа.");
  }
});

// 📌 Команда /track <VK_ID> (Добавить пользователя в отслеживание)
bot.onText(/\/track (\d+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const vkId = match[1];

 // Проверка, что команду может выполнить только администратор
 if (!allowedAdmins.includes(chatId)) {
  return bot.sendMessage(chatId, '❌ У вас нет прав для использования этой команды.');
}

  db.get("SELECT * FROM tracked_users WHERE vk_id = ?", [vkId], (err, row) => {
    if (err) {
      return bot.sendMessage(chatId, "⚠ Ошибка при добавлении пользователя.");
    }

    if (row) {
      return bot.sendMessage(chatId, "❌ Этот пользователь уже отслеживается.");
    }

    db.run("INSERT INTO tracked_users (vk_id) VALUES (?)", [vkId], (err) => {
      if (err) {
        return bot.sendMessage(chatId, "⚠ Ошибка при добавлении в базу.");
      }
    
      // Уведомление о добавлении в отслеживание
      bot.sendMessage(chatId, "✅ Пользователь добавлен в отслеживание.");
      
      // Старт отслеживания изменений
      startTracking(vkId)
    });
  });
});

const userCache = {}; // Хранилище для сохранения состояния пользователей

// 📌 Функция для отслеживания изменений профиля
async function startTracking(vkId) {
  try {
    // Получаем информацию о пользователе
    const response = await vk.api.users.get({
      user_ids: vkId,
      fields: "friends,photo_max_orig,city,verified,last_seen,status,subscriptions,online,followers_count,common_count,connections,bdate,sex,relation,about,interests,music,books,movies,quotes,followers,groups",
    });

    if (!response.length) {
      console.error("Пользователь не найден или ошибка при получении данных.");
      return;
    }

    const user = response[0];
    const currentState = {};

    // Заполняем текущее состояние пользователя только если данные существуют
    if (user.friends !== undefined) currentState.friends = user.friends;
    if (user.photo_max_orig !== undefined) currentState.photo_max_orig = user.photo_max_orig;
    if (user.status !== undefined) currentState.status = user.status;
    if (user.subscriptions !== undefined) currentState.subscriptions = user.subscriptions;
    if (user.last_seen !== undefined) currentState.last_seen = user.last_seen.time;
    if (user.city !== undefined && user.city.title !== undefined) currentState.city = user.city.title;
    if (user.verified !== undefined) currentState.verified = user.verified;
    if (user.online !== undefined) currentState.online = user.online;
    if (user.followers_count !== undefined) currentState.followers_count = user.followers_count;
    if (user.common_count !== undefined) currentState.common_count = user.common_count;
    if (user.connections !== undefined) currentState.connections = user.connections;
    if (user.bdate !== undefined) currentState.bdate = user.bdate;
    if (user.sex !== undefined) currentState.sex = user.sex;
    if (user.relation !== undefined) currentState.relation = user.relation;
    if (user.about !== undefined) currentState.about = user.about;
    if (user.interests !== undefined) currentState.interests = user.interests;
    if (user.music !== undefined) currentState.music = user.music;
    if (user.books !== undefined) currentState.books = user.books;
    if (user.movies !== undefined) currentState.movies = user.movies;
    if (user.quotes !== undefined) currentState.quotes = user.quotes;
    if (user.groups !== undefined) currentState.groups = user.groups;

    const events = [];

    // Запись изменений
    if (userCache[vkId]) {
      // Добавление друзей
      if (userCache[vkId].friends && currentState.friends) {
        const newFriends = currentState.friends.filter(friend => !userCache[vkId].friends.includes(friend));
        const removedFriends = userCache[vkId].friends.filter(friend => !currentState.friends.includes(friend));
        
        if (newFriends.length > 0) {
          events.push(`👥 Добавление в друзья: [${user.first_name} ${user.last_name}](https://vk.com/id${vkId}) добавил в друзья: ${newFriends.join(", ")}`);
        }
        if (removedFriends.length > 0) {
          events.push(`👥 Удаление из друзей: [${user.first_name} ${user.last_name}](https://vk.com/id${vkId}) удалил из друзей: ${removedFriends.join(", ")}`);
        }
      }

      // Добавление подписок
      if (userCache[vkId].subscriptions && currentState.subscriptions) {
        const newSubscriptions = currentState.subscriptions.filter(sub => !userCache[vkId].subscriptions.includes(sub));
        const removedSubscriptions = userCache[vkId].subscriptions.filter(sub => !currentState.subscriptions.includes(sub));

        if (newSubscriptions.length > 0) {
          events.push(`📲 Подписка на сообщества: ${newSubscriptions.join(", ")}`);
        }
        if (removedSubscriptions.length > 0) {
          events.push(`📉 Отписка от сообщества: ${removedSubscriptions.join(", ")}`);
        }
      }

      // Прочие изменения
      if (userCache[vkId].photo_max_orig !== currentState.photo_max_orig) {
        events.push(`📸 Изменение фото профиля: [Смотреть изображение](${user.photo_max_orig})`);
      }
      if (userCache[vkId].status !== currentState.status) {
        events.push(`📝 Изменение статуса: ${user.status}`);
      }
      if (userCache[vkId].last_seen !== currentState.last_seen) {
        const statusEmoji = currentState.last_seen > Date.now() / 1000 ? "✅ В сети" : "❌ Вышел из сети";
        events.push(`🌐 Статус сети: ${statusEmoji}`);
      }
      if (userCache[vkId].city !== currentState.city) {
        events.push(`🏙 Изменение города: ${user.city.title}`);
      }
      if (userCache[vkId].verified !== currentState.verified) {
        events.push(`🔹 Верификация: ${currentState.verified ? "✅ Верифицирован" : "❌ Не верифицирован"}`);
      }
      if (userCache[vkId].online !== currentState.online) {
        events.push(`💬 Статус онлайн: ${currentState.online === 1 ? "✅ Онлайн" : "❌ Не онлайн"}`);
      }
      if (userCache[vkId].followers_count !== currentState.followers_count) {
        events.push(`👥 Количество подписчиков: ${user.followers_count}`);
      }
      if (userCache[vkId].common_count !== currentState.common_count) {
        events.push(`👫 Общие друзья: ${user.common_count}`);
      }
      if (userCache[vkId].connections !== currentState.connections) {
        if (currentState.connections) {
          if (currentState.connections.facebook) events.push(`🔗 Facebook: [Ссылка на профиль](https://www.facebook.com/${currentState.connections.facebook})`);
          if (currentState.connections.instagram) events.push(`📷 Instagram: [Ссылка на профиль](https://www.instagram.com/${currentState.connections.instagram})`);
          if (currentState.connections.twitter) events.push(`🐦 Twitter: [Ссылка на профиль](https://twitter.com/${currentState.connections.twitter})`);
        }
      }
      if (userCache[vkId].bdate !== currentState.bdate) {
        events.push(`🎂 Дата рождения: ${currentState.bdate}`);
      }
      if (userCache[vkId].sex !== currentState.sex) {
        events.push(`👤 Пол: ${currentState.sex === 1 ? "👩 Женский" : currentState.sex === 2 ? "👨 Мужской" : "❓ Не указан"}`);
      }
      if (userCache[vkId].relation !== currentState.relation) {
        const relationStatuses = ["Не в отношениях", "Встречается", "Помолвлен", "Женат", "В поиске", "В отношениях", "Развод"];
        events.push(`💍 Отношения: ${relationStatuses[currentState.relation] || "Не указан"}`);
      }
      if (userCache[vkId].about !== currentState.about) {
        events.push(`📝 О себе: ${currentState.about}`);
      }
      if (userCache[vkId].interests !== currentState.interests) {
        events.push(`🎯 Интересы: ${currentState.interests}`);
      }
      if (userCache[vkId].music !== currentState.music) {
        events.push(`🎶 Музыкальные предпочтения: ${currentState.music}`);
      }
      if (userCache[vkId].books !== currentState.books) {
        events.push(`📚 Книги: ${currentState.books}`);
      }
      if (userCache[vkId].movies !== currentState.movies) {
        events.push(`🎬 Фильмы: ${currentState.movies}`);
      }
      if (userCache[vkId].quotes !== currentState.quotes) {
        events.push(`💬 Цитаты: ${currentState.quotes}`);
      }
      if (userCache[vkId].groups !== currentState.groups) {
        const groupEvents = currentState.groups.map(group => `🔔 Подписка на сообщество: [${group.name}](https://vk.com/club${group.id})`);
        events.push(...groupEvents);

        // Отправка уведомления об отписке от сообщества
        const oldGroups = userCache[vkId].groups.filter(group => !currentState.groups.some(g => g.id === group.id));
        oldGroups.forEach(group => {
          events.push(`📉 Отписка от сообщества: [${group.name}](https://vk.com/club${group.id})`);
        });
      }
    }

    // Обновляем кэш для пользователя
    userCache[vkId] = currentState;

    // Если есть изменения, отправляем логи
    if (events.length > 0) {
      bot.sendMessage(process.env.ADMIN_CHAT_ID, `📋 Логи изменений для пользователя [${user.first_name} ${user.last_name}](https://vk.com/id${vkId}):\n${events.join("\n")}`, { parse_mode: "Markdown" });
    }

  } catch (error) {
    console.error(`Ошибка отслеживания изменений для пользователя ${vkId}: ${error.message}`);
  }
}


// 📌 Функция для периодической проверки изменений
async function periodicTracking() {
  const users = await new Promise((resolve) => {
    db.all("SELECT vk_id FROM tracked_users", [], (err, rows) => {
      if (err) resolve([]);
      resolve(rows.map((row) => row.vk_id));
    });
  });

  for (const vkId of users) {
    await startTracking(vkId);
  }
}

// 📌 команда info
bot.onText(/\/info (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const vkId = match[1];  // Use vkId from the command input

  async function getVkUserId(input) {
    try {
      const vkUser = await vk.api.users.get({ user_ids: input });
      if (vkUser && vkUser.length > 0) {
        return vkUser[0].id;
      }
      return null;
    } catch (error) {
      console.error("Error fetching VK user ID:", error);
      return null;
    }
  }

  function getPlatform(platformId) {
    switch (platformId) {
      case 1:
        return 'Мобильное приложение';
      case 2:
        return 'Мобильная версия';
      case 3:
        return 'Десктопное приложение';
      case 4:
        return 'Веб-версия';
      default:
        return 'Неизвестно';
    }
  }

  function getElapsedTime(lastSeenTime) {
    const now = Date.now() / 1000;  // Current time in seconds
    const diff = now - lastSeenTime; // Difference between current time and last seen time
  
    const minutes = Math.floor(diff / 60);
    const hours = Math.floor(diff / 3600);
    const days = Math.floor(diff / 86400);
  
    if (days > 0) {
      return `${days} дн. назад`;
    } else if (hours > 0) {
      return `${hours} ч. назад`;
    } else if (minutes > 0) {
      return `${minutes} мин. назад`;
    } else {
      return 'Только что';
    }
  }

  try {
    const userId = await getVkUserId(vkId);  // Pass vkId here
    if (!userId) {
      return bot.sendMessage(chatId, '❌ Не удалось найти профиль.');
    }

    const profile = await vk.api.users.get({
      user_ids: userId,
      fields: 'photo_200, last_seen, counters, online, online_mobile, bdate, city, country, sex, status, education, home_town, followers_count'
    });

    if (!profile.length) {
      return bot.sendMessage(chatId, '❌ Не удалось получить информацию.');
    }

    const user = profile[0];
    const lastSeenTime = user.last_seen ? new Date(user.last_seen.time * 1000).toLocaleString() : 'Неизвестно';
    const lastSeenPlatform = getPlatform(user.last_seen?.platform);
    const elapsedTime = user.last_seen ? getElapsedTime(user.last_seen.time) : 'Неизвестно';

    const profilePic = user.photo_200 || '';
    const city = user.city ? user.city.title : 'Не указано';
    const country = user.country ? user.country.title : 'Не указано';
    const sex = user.sex === 1 ? 'Женский' : user.sex === 2 ? 'Мужской' : 'Не указан';
    const education = user.education ? `${user.education.university_name}, ${user.education.faculty_name}, ${user.education.chair_name}` : 'Не указано';
    const homeTown = user.home_town || 'Не указано';
    const status = user.status || 'Нет статуса';
    const birthday = user.bdate || 'Не указана';
    const followers = user.counters?.followers || 0;  // Followers count
    const friends = user.counters?.friends || 0;  // Friends count

    const htmlContent = generateHtml(user, profilePic, lastSeenTime, lastSeenPlatform, elapsedTime, city, country, sex, education, homeTown, status, birthday, followers, friends);
    const filePath = path.join(__dirname, `profile_${user.id}.html`);

    fs.writeFileSync(filePath, htmlContent);

    bot.sendDocument(chatId, filePath, { caption: "🔗 Откройте этот файл в браузере" }).then(() => {
      fs.unlinkSync(filePath);
    });

  } catch (error) {
    console.error(error);
    bot.sendMessage(chatId, '❌ Ошибка при получении данных.');
  }
});

function generateHtml(user, profilePic, lastSeenTime, lastSeenPlatform, elapsedTime, city, country, sex, education, homeTown, status, birthday, followers, friends) {
  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Профиль ВКонтакте</title>
  <style>
    body { 
      font-family: Arial, sans-serif; 
      background: linear-gradient(45deg, #ff0000, #ff7300, #fffb00, #00ff00, #0000ff, #8a00ff); 
      background-size: 400% 400%; 
      animation: gradientAnimation 15s ease infinite; 
      text-align: center; 
      margin: 0; 
      padding: 0; 
      min-height: 100vh;
      color: white; /* Белый текст */
    }
    @keyframes gradientAnimation { 
      0% { background-position: 0% 50%; } 
      50% { background-position: 100% 50%; } 
      100% { background-position: 0% 50%; } 
    }
    .container { 
      width: 300px; 
      background: rgba(0, 0, 0, 0.8); 
      padding: 15px; 
      margin: 50px auto; 
      border-radius: 10px; 
      box-shadow: 0px 0px 10px rgba(0, 0, 0, 0.2); 
    }
    .avatar { 
      width: 80px; 
      height: 80px; 
      border-radius: 50%; 
      margin-bottom: 10px; 
    }
    .info { 
      text-align: left; 
      font-size: 14px; 
    }
    footer { 
      position: fixed; 
      bottom: 10px; 
      width: 100%; 
      text-align: center; 
      font-size: 12px; 
      color: white; 
      background-color: rgba(0, 0, 0, 0.5); 
      padding: 5px 0; 
    }
    footer a { color: #fffb00; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <img src="${profilePic}" class="avatar" alt="Фото профиля">
    <h2>${user.first_name} ${user.last_name}</h2>
    <div class="info">
      <p><b>Последний вход:</b> ${lastSeenTime} (${elapsedTime})</p>
      <p><b>Устройство:</b> ${lastSeenPlatform}</p>
      <p><b>Город:</b> ${city}</p>
      <p><b>Страна:</b> ${country}</p>
      <p><b>Пол:</b> ${sex}</p>
      <p><b>Дата рождения:</b> ${birthday}</p>
      <p><b>Статус:</b> ${status}</p>
      <p><b>Родной город:</b> ${homeTown}</p>
      <p><b>Образование:</b> ${education}</p>
      <p><b>Друзья:</b> ${friends}</p>
      <p><b>Подписчики:</b> ${followers}</p>
    </div>
  </div>
  <footer>Developer INK</footer>
</body>
</html>`; 
}

//📌 команда /друзья 
bot.onText(/\/друзья (\d+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const vkId = match[1];  // Извлекаем vkId из команды

  async function getVkUserId(input) {
    try {
      const vkUser = await vk.api.users.get({ user_ids: input });
      if (vkUser && vkUser.length > 0) {
        return vkUser[0].id;  // Возвращаем id пользователя
      }
      return null;
    } catch (error) {
      console.error("Ошибка при получении данных пользователя:", error);
      return null;
    }
  }

  // Получаем id пользователя ВКонтакте
  const userId = await getVkUserId(vkId);
  if (!userId) {
    return bot.sendMessage(chatId, 'Не удалось найти пользователя или профиль закрыт.');
  }

  try {
    // Запрос к API ВКонтакте для получения списка друзей
    const response = await vk.api.friends.get({
      user_id: userId,
      order: 'name',
      fields: 'first_name,last_name,photo_100',
    });

    const friends = response.items || [];
    if (friends.length === 0) {
      return bot.sendMessage(chatId, 'У пользователя нет друзей или профиль закрыт.');
    }

    // Генерация HTML для списка друзей
    let friendsHtml = '';
    friends.forEach(friend => {
      friendsHtml += `<div class="friend">
          <img src="${friend.photo_100}" class="avatar" alt="Фото профиля">
          <p>${friend.first_name} ${friend.last_name}</p>
      </div>`;
    });

    // Генерация полного HTML-документа
    const htmlContent = `<!DOCTYPE html>
    <html lang="ru">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Список друзей ВКонтакте</title>
      <style>
        body { 
          font-family: Arial, sans-serif; 
          background: linear-gradient(45deg, #ff0000, #ff7300, #fffb00, #00ff00, #0000ff, #8a00ff); 
          background-size: 400% 400%; 
          animation: gradientAnimation 15s ease infinite; 
          text-align: center; 
          margin: 0; 
          padding: 0; 
          min-height: 100vh;
          color: white; /* Белый текст */
        }
        @keyframes gradientAnimation { 
          0% { background-position: 0% 50%; } 
          50% { background-position: 100% 50%; } 
          100% { background-position: 0% 50%; } 
        }
        .container { 
          width: 300px; 
          background: rgba(0, 0, 0, 0.8); 
          padding: 15px; 
          margin: 50px auto; 
          border-radius: 10px; 
          box-shadow: 0px 0px 10px rgba(0, 0, 0, 0.2); 
        }
        .friend { 
          margin-bottom: 10px; 
          display: flex; 
          align-items: center; 
          justify-content: center;
        }
        .avatar { 
          width: 50px; 
          height: 50px; 
          border-radius: 50%; 
          margin-right: 10px; 
        }
        .friend-info { 
          text-align: left; 
          font-size: 14px; 
        }
        footer { 
          position: fixed; 
          bottom: 10px; 
          width: 100%; 
          text-align: center; 
          font-size: 12px; 
          color: white; 
          background-color: rgba(0, 0, 0, 0.5); 
          padding: 5px 0; 
        }
        footer a { color: #fffb00; text-decoration: none; }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>Друзья пользователя</h2>
        ${friendsHtml}
      </div>
      <footer>Developer INK</footer>
    </body>
    </html>`;

    // Сохранение HTML в файл
    const filePath = `friends_${userId}.html`;
    fs.writeFileSync(filePath, htmlContent);

    // Отправка файла в Telegram
    await bot.sendDocument(chatId, filePath, { caption: 'Вот список друзей:' });

    // Удаление файла после отправки
    fs.unlinkSync(filePath);
  } catch (error) {
    console.error(error);
    bot.sendMessage(chatId, 'Ошибка при получении списка друзей. Возможно, профиль закрыт или ID указан неверно.');
  }
});

//📌 команда /подписчики 
bot.onText(/\/подписчики (\d+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const vkId = match[1];  // Извлекаем vkId из команды

  async function getVkUserId(input) {
    try {
      const vkUser = await vk.api.users.get({ user_ids: input });
      if (vkUser && vkUser.length > 0) {
        return vkUser[0].id;  // Возвращаем id пользователя
      }
      return null;
    } catch (error) {
      console.error("Ошибка при получении данных пользователя:", error);
      return null;
    }
  }

  // Получаем id пользователя ВКонтакте
  const userId = await getVkUserId(vkId);
  if (!userId) {
    return bot.sendMessage(chatId, 'Не удалось найти пользователя или профиль закрыт.');
  }

  try {
    // Запрос к API ВКонтакте для получения списка подписчиков пользователя
    const response = await vk.api.users.getFollowers({
      user_id: userId,
      count: 100,  // Количество подписчиков, по умолчанию до 100
      fields: 'first_name,last_name,photo_100',  // Поля для каждого подписчика
    });

    const followers = response.items || [];
    if (followers.length === 0) {
      return bot.sendMessage(chatId, 'У пользователя нет подписчиков или профиль закрыт.');
    }

    // Генерация HTML для списка подписчиков
    let followersHtml = '';
    followers.forEach(follower => {
      followersHtml += `<div class="follower">
          <img src="${follower.photo_100}" class="avatar" alt="Фото профиля">
          <p>${follower.first_name} ${follower.last_name}</p>
      </div>`;
    });

    // Генерация полного HTML-документа
    const htmlContent = `<!DOCTYPE html>
    <html lang="ru">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Список подписчиков ВКонтакте</title>
      <style>
        body { 
          font-family: Arial, sans-serif; 
          background: linear-gradient(45deg, #ff0000, #ff7300, #fffb00, #00ff00, #0000ff, #8a00ff); 
          background-size: 400% 400%; 
          animation: gradientAnimation 15s ease infinite; 
          text-align: center; 
          margin: 0; 
          padding: 0; 
          min-height: 100vh;
          color: white; /* Белый текст */
        }
        @keyframes gradientAnimation { 
          0% { background-position: 0% 50%; } 
          50% { background-position: 100% 50%; } 
          100% { background-position: 0% 50%; } 
        }
        .container { 
          width: 300px; 
          background: rgba(0, 0, 0, 0.8); 
          padding: 15px; 
          margin: 50px auto; 
          border-radius: 10px; 
          box-shadow: 0px 0px 10px rgba(0, 0, 0, 0.2); 
        }
        .follower { 
          margin-bottom: 10px; 
          display: flex; 
          align-items: center; 
          justify-content: center;
        }
        .avatar { 
          width: 50px; 
          height: 50px; 
          border-radius: 50%; 
          margin-right: 10px; 
        }
        .follower-info { 
          text-align: left; 
          font-size: 14px; 
        }
        footer { 
          position: fixed; 
          bottom: 10px; 
          width: 100%; 
          text-align: center; 
          font-size: 12px; 
          color: white; 
          background-color: rgba(0, 0, 0, 0.5); 
          padding: 5px 0; 
        }
        footer a { color: #fffb00; text-decoration: none; }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>Подписчики пользователя</h2>
        ${followersHtml}
      </div>
      <footer>Developer INK</footer>
    </body>
    </html>`;

    // Сохранение HTML в файл
    const filePath = `followers_${userId}.html`;
    fs.writeFileSync(filePath, htmlContent);

    // Отправка файла в Telegram
    await bot.sendDocument(chatId, filePath, { caption: 'Вот список подписчиков:' });

    // Удаление файла после отправки
    fs.unlinkSync(filePath);
  } catch (error) {
    console.error(error);
    bot.sendMessage(chatId, 'Ошибка при получении списка подписчиков. Возможно, профиль закрыт или ID указан неверно.');
  }
});

//📌 команда /подписки 
bot.onText(/\/подписки (\d+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const vkId = match[1];  // Извлекаем vkId из команды

  async function getVkUserId(input) {
    try {
      const vkUser = await vk.api.users.get({ user_ids: input });
      if (vkUser && vkUser.length > 0) {
        return vkUser[0].id;  // Возвращаем id пользователя
      }
      return null;
    } catch (error) {
      console.error("Ошибка при получении данных пользователя:", error);
      return null;
    }
  }

  // Получаем id пользователя ВКонтакте
  const userId = await getVkUserId(vkId);
  if (!userId) {
    return bot.sendMessage(chatId, 'Не удалось найти пользователя или профиль закрыт.');
  }

  try {
    // Запрос к API ВКонтакте для получения списка подписок
    const response = await vk.api.users.getSubscriptions({
      user_id: userId,
      extended: 1,  // Расширенные данные о подписках
      fields: 'name,photo_100',  // Дополнительные данные о сообществе
    });

    const subscriptions = response.items || [];
    if (subscriptions.length === 0) {
      return bot.sendMessage(chatId, 'У пользователя нет подписок или профиль закрыт.');
    }

    // Генерация HTML для списка подписок
    let subscriptionsHtml = '';
    subscriptions.forEach(subscriber => {
      subscriptionsHtml += `<div class="subscription">
          <img src="${subscriber.photo_100}" class="avatar" alt="Фото сообщества">
          <p>${subscriber.name}</p>
      </div>`;
    });

    // Генерация полного HTML-документа
    const htmlContent = `<!DOCTYPE html>
    <html lang="ru">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Список подписок пользователя ВКонтакте</title>
      <style>
        body { 
          font-family: Arial, sans-serif; 
          background: linear-gradient(45deg, #ff0000, #ff7300, #fffb00, #00ff00, #0000ff, #8a00ff); 
          background-size: 400% 400%; 
          animation: gradientAnimation 15s ease infinite; 
          text-align: center; 
          margin: 0; 
          padding: 0; 
          min-height: 100vh;
          color: white; /* Белый текст */
        }
        @keyframes gradientAnimation { 
          0% { background-position: 0% 50%; } 
          50% { background-position: 100% 50%; } 
          100% { background-position: 0% 50%; } 
        }
        .container { 
          width: 300px; 
          background: rgba(0, 0, 0, 0.8); 
          padding: 15px; 
          margin: 50px auto; 
          border-radius: 10px; 
          box-shadow: 0px 0px 10px rgba(0, 0, 0, 0.2); 
        }
        .subscription { 
          margin-bottom: 10px; 
          display: flex; 
          align-items: center; 
          justify-content: center;
        }
        .avatar { 
          width: 50px; 
          height: 50px; 
          border-radius: 50%; 
          margin-right: 10px; 
        }
        footer { 
          position: fixed; 
          bottom: 10px; 
          width: 100%; 
          text-align: center; 
          font-size: 12px; 
          color: white; 
          background-color: rgba(0, 0, 0, 0.5); 
          padding: 5px 0; 
        }
        footer a { color: #fffb00; text-decoration: none; }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>Подписки пользователя</h2>
        ${subscriptionsHtml}
      </div>
      <footer>Developer INK</footer>
    </body>
    </html>`;

    // Сохранение HTML в файл
    const filePath = `subscriptions_${userId}.html`;
    fs.writeFileSync(filePath, htmlContent);

    // Отправка файла в Telegram
    await bot.sendDocument(chatId, filePath, { caption: 'Вот список подписок пользователя:' });

    // Удаление файла после отправки
    fs.unlinkSync(filePath);
  } catch (error) {
    console.error(error);
    bot.sendMessage(chatId, 'Ошибка при получении списка подписок. Возможно, профиль закрыт или ID указан неверно.');
  }
});

//📌 команда photo
bot.onText(/\/photo (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const vkId = match[1];

  async function getVkUserId(input) {
    try {
      const vkUser = await vk.api.users.get({ user_ids: input });
      if (vkUser && vkUser.length > 0) {
        return vkUser[0].id;
      }
      return null;
    } catch (error) {
      console.error("Ошибка при получении ID пользователя VK:", error);
      return null;
    }
  }

  function getElapsedTime(lastSeenTime) {
    const now = Date.now() / 1000;
    const diff = now - lastSeenTime;

    const minutes = Math.floor(diff / 60);
    const hours = Math.floor(diff / 3600);
    const days = Math.floor(diff / 86400);

    if (days > 0) return `${days} дн. назад`;
    if (hours > 0) return `${hours} ч. назад`;
    if (minutes > 0) return `${minutes} мин. назад`;
    return "Только что";
  }

  try {
    const userId = await getVkUserId(vkId);
    if (!userId) {
      return bot.sendMessage(chatId, "❌ Не удалось найти профиль.");
    }

    const profile = await vk.api.users.get({
      user_ids: userId,
      fields:
        "photo_max_orig,last_seen,counters,followers_count,city,verified,status,site,sex,relation,bdate,has_mobile,is_closed,is_premium,wall_comments,blacklisted",
    });

    if (!profile.length) {
      return bot.sendMessage(chatId, "❌ Не удалось получить данные.");
    }

    const user = profile[0];
    const avatarUrl = user.photo_max_orig;
    const lastSeenTime = user.last_seen ? getElapsedTime(user.last_seen.time) : "Неизвестно";
    const friendsCount = user.counters?.friends || 0;
    const followersCount = user.counters?.followers || 0;
    const city = user.city ? user.city.title : "Не указан";
    const verified = user.verified ? "✅ Да" : "❌ Нет";
    const online = user.online ? "🟢 Онлайн" : "🔴 Оффлайн";
    const device = user.last_seen ? `ID ${user.last_seen.platform}` : "Неизвестно";
    const status = user.status || "Не указан";
    const sex = user.sex === 1 ? "👩 Женский" : user.sex === 2 ? "👨 Мужской" : "Не указан";
    const bdate = user.bdate || "Не указана";
    const hasMobile = user.has_mobile ? "✅ Да" : "❌ Нет";
    const isClosed = user.is_closed ? "🔒 Закрытый" : "🔓 Открытый";
    const wallComments = user.wall_comments ? "✅ Разрешены" : "❌ Запрещены";
    const blacklisted = user.blacklisted ? "✅ В ЧС" : "❌ Нет";
    const site = user.site || "Не указан";
    const relation = user.relation || "Не указаны";
    const photosCount = user.counters?.photos || 0;
    const videosCount = user.counters?.videos || 0;
    const giftsCount = user.counters?.gifts || 0;
    const wallPostsCount = user.counters?.posts || 0;

    const canvas = createCanvas(600, 750); // Увеличена высота
    const ctx = canvas.getContext("2d");

    // Заливка фона
    ctx.fillStyle = "#282c34";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Загружаем аватарку
    const avatar = await loadImage(avatarUrl);
    ctx.drawImage(avatar, 20, 20, 120, 120);

    // Имя пользователя
    ctx.fillStyle = "white";
    ctx.font = "bold 24px Arial";
    ctx.fillText(`${user.first_name} ${user.last_name}`, 160, 50);

    // Данные профиля
    ctx.font = "18px Arial";
    let y = 90;
    const lineSpacing = 30;

    const userData = [
      `🏙 Город: ${city}`,
      `🔹 Верифицирован: ${verified}`,
      `⏳ Последний вход: ${lastSeenTime}`,
      `📱 Устройство: ${device}`,
      `🏷 Статус: ${status}`,
      `🔵 Онлайн: ${online}`,
      `👥 Пол: ${sex}`,
      `🎂 Дата рождения: ${bdate}`,
      `📱 Привязан телефон: ${hasMobile}`,
      `🔑 Подтверждение входа: ${hasMobile}`,
      `📧 Привязана почта: ${hasMobile}`,
      `🚫 Черный список: ${blacklisted}`,
      `🔗 Сайт: ${site}`,
      `🔒 Приватность профиля: ${isClosed}`,
      `💬 Комментарии на стене: ${wallComments}`,
      `❤️ Отношения: ${relation}`,
      `🎥 Видео: ${videosCount}`,
      `📸 Фотографии: ${photosCount}`,
      `🎁 Подарки: ${giftsCount}`,
      `📝 Записи на стене: ${wallPostsCount}`,
      `👫 Друзья: ${friendsCount}`,
      `👥 Подписчики: ${followersCount}`,
    ];

    userData.forEach((text) => {
      ctx.fillText(text, 160, y);
      y += lineSpacing;
    });

    // Добавляем надпись "Developer by INK" внизу
    ctx.fillStyle = "gray";
    ctx.font = "italic 16px Arial";
    ctx.fillText("Developer by INK", canvas.width - 180, canvas.height - 20);

    // Сохранение изображения
    const filePath = path.join(__dirname, `profile_${user.id}.png`);
    const out = fs.createWriteStream(filePath);
    const stream = canvas.createPNGStream();
    stream.pipe(out);

    out.on("finish", () => {
      bot.sendPhoto(chatId, filePath, {
        caption: `📜 Информация о пользователе [${user.first_name} ${user.last_name}](https://vk.com/id${userId})`,
        parse_mode: "Markdown",
      }).then(() => fs.unlinkSync(filePath));
    });

  } catch (error) {
    console.error("Ошибка:", error);
    bot.sendMessage(chatId, "❌ Ошибка при получении данных.");
  }
});

//📌 команда settings
// Функция для получения информации о пользователе ВКонтакте
async function getVkUserInfo() {
  try {
    const response = await vk.api.users.get({ access_token: process.env.VK_ACCESS_TOKEN });
    return response[0]; // Возвращаем данные о пользователе
  } catch (error) {
    console.error('Ошибка при получении данных о пользователе ВКонтакте:', error);
    return null;
  }
}

// Функция для проверки действительности токена ВКонтакте
async function checkVkToken() {
  try {
    const response = await axios.get('https://api.vk.com/method/users.get', {
      params: {
        access_token: process.env.VK_ACCESS_TOKEN,  // Токен ВКонтакте
        v: '5.131',  // Версия API ВКонтакте
      },
    });

    if (response.data && response.data.response && response.data.response.length > 0) {
      return true;  // Токен действителен
    } else {
      return false;  // Токен не действителен
    }
  } catch (error) {
    console.error('Ошибка при проверке токена:', error);
    return false;  // Токен не действителен
  }
}

// Основной обработчик для команды /settings
bot.onText(/\/settings/, async (msg) => {
  const chatId = msg.chat.id;

  // Проверка, что команду может выполнить только администратор
  if (!allowedAdmins.includes(chatId)) {
    return bot.sendMessage(chatId, '❌ У вас нет прав для использования этой команды.');
  }

  const uptime = moment.duration(process.uptime(), 'seconds').humanize();  // Время работы бота
  const vkUserInfo = await getVkUserInfo();
  const vkTokenValid = await checkVkToken() ? "✅ Токен ВКонтакте действителен" : "❌ Токен ВКонтакте не действителен";

  const settingsMessage = `
    🔧 **Настройки бота**:
    - **Время работы**: ${uptime}
    - **Владелец токена (ВКонтакте)**: ${vkUserInfo ? vkUserInfo.first_name + " " + vkUserInfo.last_name : "Не удалось получить данные"}
    - **Статус токена ВКонтакте**: ${vkTokenValid}
  `;

  // Создание кнопок для перезапуска бота и проверки токена
  const options = {
    reply_markup: {
      inline_keyboard: [
        [{ text: "✅ Перезапустить бота", callback_data: 'restart' }],
        [{ text: "🔍 Проверить токен ВКонтакте", callback_data: 'check_token' }]
      ]
    }
  };

  // Отправляем информацию в чат
  bot.sendMessage(chatId, settingsMessage, options);
});

// Обработка нажатий на кнопки
bot.on('callback_query', async (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;

  if (data === 'restart') {
    // Перезапуск бота
    bot.sendMessage(chatId, '⚙️ Бот перезапускается...');
    exec('node index.js', (error, stdout, stderr) => {
      if (error) {
        return bot.sendMessage(chatId, `❌ Ошибка перезапуска: ${error.message}`);
      }
      if (stderr) {
        return bot.sendMessage(chatId, `❌ Ошибка: ${stderr}`);
      }
      bot.sendMessage(chatId, '✅ Бот перезапущен успешно!');
      process.exit();  // Завершаем текущий процесс
    });
  }

  if (data === 'check_token') {
    // Проверка токена ВКонтакте
    const vkTokenValid = await checkVkToken() ? "✅ Токен ВКонтакте действителен" : "❌ Токен ВКонтакте не действителен";
    bot.sendMessage(chatId, `Статус токена ВКонтакте: ${vkTokenValid}`);
  }

  // Ответ на запрос
  bot.answerCallbackQuery(callbackQuery.id);
});


//📌 команда update
bot.onText(/\/update/, async (msg) => {
  const chatId = msg.chat.id;

  // Создаем холст
  const canvas = createCanvas(600, 400);
  const ctx = canvas.getContext("2d");

  // Задний фон
  ctx.fillStyle = "#282c34";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Заголовок "VK Шпион v1.3"
  ctx.fillStyle = "white";
  ctx.font = "bold 30px Arial";
  ctx.textAlign = "center";
  ctx.fillText("VK Шпион v1.3", canvas.width / 2, 80);

  // Блок описания обновления
  ctx.fillStyle = "#444";
  ctx.fillRect(50, 120, 500, 180);

  // Текст описания обновления
  ctx.fillStyle = "white";
  ctx.font = "18px Arial";
  ctx.textAlign = "center";
  ctx.fillText("Добавили больше команд на получение информации !", canvas.width / 2, 160);

  // Подпись разработчика
  ctx.fillStyle = "#999";
  ctx.font = "16px Arial";
  ctx.fillText("Developer by INK", canvas.width / 2, 350);

  // Сохранение изображения
  const filePath = path.join(__dirname, "update_info.png");
  const out = fs.createWriteStream(filePath);
  const stream = canvas.createPNGStream();
  stream.pipe(out);

  out.on("finish", () => {
    bot.sendPhoto(chatId, filePath, {
      caption: "🆕 Обновление VK Шпион v1.3",
    }).then(() => fs.unlinkSync(filePath));
  });
});


// Запуск периодической проверки изменений каждые 10 секунд
setInterval(periodicTracking, 10 * 1000); // 10 секунд
