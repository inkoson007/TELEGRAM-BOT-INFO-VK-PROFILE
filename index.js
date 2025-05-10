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
const osu = require('os-utils');


const allowedAdmins = [1364548192];  // Массив с ID пользователей, которым разрешено использовать команду, получить через бота @userinfobot

// Подключение к БД
const db = new sqlite3.Database("tracking.db", (err) => {
  if (err) console.error("Ошибка подключения к БД:", err.message);
  else console.log("✅ Подключено к базе данных SQLite.");
});

// Конфигурация
const config = {
  version: '2.1',
  author: 'INK'
};

// Красивый вывод в консоль при старте
function showWelcomeMessage() {
  console.log('\x1b[36m%s\x1b[0m', '╔════════════════════════════════════════════╗');
  console.log('\x1b[36m%s\x1b[0m', `║            VK Шпион v${config.version}           ║`);
  console.log('\x1b[36m%s\x1b[0m', '╟────────────────────────────────────────────╢');
  console.log('\x1b[36m%s\x1b[0m', `║  Разработчик: ${config.author}                  ║`);
  console.log('\x1b[36m%s\x1b[0m', '║                                            ║');
  console.log('\x1b[36m%s\x1b[0m', '║  Запуск бота...                            ║');
  console.log('\x1b[36m%s\x1b[0m', '╚════════════════════════════════════════════╝');
  console.log('\x1b[33m%s\x1b[0m', `⌛ Инициализация модулей...`);
}

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
showWelcomeMessage();

// 📌 Команда /start (Приветствие)
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, `👋 Привет, ${msg.from.first_name}!
Я бот для отслеживания изменений профилей ВКонтакте. Version 1.9.2

📝 Используйте /help для просмотра доступных команд.`);
});

// Список известных команд
const knownCommands = [
  '/start', '/help', '/track', '/profile', '/gprofile', '/info',
  '/ginfo', '/photo', '/друзья', '/подписчики', '/подписки',
  '/участники', '/id', '/gid', '/statistic', '/like', '/post', '/общение',
  '/settings', '/update'
];

// Обработка всех сообщений
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text.trim();

  // Проверяем, является ли сообщение неизвестной командой
  if (text.startsWith('/')) {
    const command = text.split(' ')[0];
    if (!knownCommands.includes(command)) {
      bot.sendMessage(chatId, '❗ Такой команды нет.\n\n📌 Посмотрите список команд с помощью /help', {
        parse_mode: 'Markdown'
      });
    }
  }
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
    📌 /gprofile <id или ссылка> - ${escapeMarkdown("Информация о группе VK")}
    📌 /info <id> - ${escapeMarkdown("Получить информацию о профиле в html")}
    📌 /ginfo <id или ссылка> - ${escapeMarkdown("Получить информацию о группе в html")}
    📌 /photo <id> - ${escapeMarkdown("Получить информацию о профиле в картинке")}
    📌 /друзья <id> - ${escapeMarkdown("Получить информацию о друзьях")}
    📌 /подписчики <id> - ${escapeMarkdown("Получить информацию о подписчиках")}
    📌 /подписки <id> - ${escapeMarkdown("Получить информацию о подписчиках")}
    📌 /участники <ссылка или id> - ${escapeMarkdown("Получить список участников группы")}
    📌 /id <ссылка на профиль> - ${escapeMarkdown("Получить id профиля")}
    📌 /gid <ссылка на группу> - ${escapeMarkdown("Получить id группы")}
    📌 /statistic <id> - ${escapeMarkdown("Получить статистику друзей")}
    📌 /like <id> - ${escapeMarkdown("Получить статистику лайков")}
    📌 /post <id> - ${escapeMarkdown("Получить посты и репосты")}
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
      fields: "photo_max_orig,city,verified,last_seen,status,online,sex,bdate,about,counters,has_mobile,blacklisted,site,relation,relation_partner,is_closed,career,military,photo_id,is_premium,wall_comments,cover"
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

    // Отправка аватара и обложки как фото
    const cover = user.cover ? user.cover.photo_800 : null; // Получаем обложку, если она есть
    const media = cover || user.photo_max_orig; // Если есть обложка, отправляем её, иначе аватар
    bot.sendPhoto(chatId, media, {
      caption: profileInfo, 
      parse_mode: "Markdown"
    });

  } catch (error) {
    bot.sendMessage(chatId, "⚠ Ошибка при получении данных профиля.");
  }
});

// 📌 Команда /gprofile 
bot.onText(/\/gprofile (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  let groupId = match[1].trim(); // Убираем лишние пробелы

  const vkUrlPattern = /(?:https?:\/\/)?(?:www\.)?vk\.com\/(club|public|event)?(\d+|[a-zA-Z0-9_.-]+)/;
  const matchResult = groupId.match(vkUrlPattern);

  if (matchResult) {
    groupId = matchResult[2] || matchResult[1];
    
    if (isNaN(groupId)) {
      try {
        const resolveResponse = await axios.get("https://api.vk.com/method/utils.resolveScreenName", {
          params: {
            screen_name: groupId,
            access_token: process.env.VK_ACCESS_TOKEN,
            v: "5.199",
          },
        });

        if (resolveResponse.data.error) {
          return bot.sendMessage(chatId, `❌ Ошибка VK API: ${resolveResponse.data.error.error_msg}`);
        }

        const resolved = resolveResponse.data.response;
        if (!resolved || resolved.type !== "group") {
          return bot.sendMessage(chatId, "❌ Группа не найдена или указан неверный тип ссылки.");
        }

        groupId = resolved.object_id;
      } catch (error) {
        return bot.sendMessage(chatId, "⚠ Ошибка при разрешении короткого имени. Проверьте правильность ссылки.");
      }
    }
  }

  try {
    const groupResponse = await axios.get("https://api.vk.com/method/groups.getById", {
      params: {
        group_id: groupId,
        fields: "photo_200,city,description,members_count,verified,cover,website",
        access_token: process.env.VK_ACCESS_TOKEN,
        v: "5.199",
      },
    });

    if (groupResponse.data.error) {
      return bot.sendMessage(chatId, `❌ Ошибка VK API: ${groupResponse.data.error.error_msg}`);
    }

    const group = groupResponse.data.response?.groups?.[0];  // Извлекаем объект из массива groups

    if (!group) {
      return bot.sendMessage(chatId, "❌ Сообщество не найдено. Проверьте правильность ID или ссылки.");
    }

    const city = group.city?.title || "Не указан";
    const verified = group.verified ? "✅ Да" : "❌ Нет";
    const description = group.description || "Нет описания";
    const membersCount = group.members_count || "Неизвестно";
    const website = group.website || "❌ Не указан";
    const cover = group.cover?.images?.pop()?.url || null; // Берем последнее изображение, если оно есть
    const avatar = group.photo_200 || null; // Аватарка сообщества

    function escapeMarkdown(text) {
      return text.replace(/([_*[\]()~`>#+\-=|{}.!])/g, "\\$1");
    }

    const groupInfo = ` 
👥 *Сообщество:* [${escapeMarkdown(group.name)}](https://vk.com/club${groupId})
🏙 *Город:* ${escapeMarkdown(city)}
🔹 *Верифицировано:* ${verified}
📜 *Описание:* ${escapeMarkdown(description)}
🔗 *Вебсайт:* ${website}
👥 *Участников:* ${membersCount}
🖼 *Аватарка:*`;

    const sendMessageOptions = {
      caption: groupInfo,
      parse_mode: "Markdown",
    };

    // Если есть аватарка, отправляем её
    if (avatar) {
      sendMessageOptions.caption = `🖼 *Аватарка:*`;
      bot.sendPhoto(chatId, avatar, sendMessageOptions);
    }

    // Если есть обложка, отправляем её
    if (cover) {
      sendMessageOptions.caption = groupInfo;
      bot.sendPhoto(chatId, cover, sendMessageOptions);
    } else {
      bot.sendMessage(chatId, groupInfo, { parse_mode: "Markdown" });
    }
  } catch (error) {
    bot.sendMessage(chatId, "⚠ Ошибка при получении данных о сообществе. Проверьте правильность ссылки или ID.");
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

    const htmlContent = usergenerateHtml(user, profilePic, lastSeenTime, lastSeenPlatform, elapsedTime, city, country, sex, education, homeTown, status, birthday, followers, friends);
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

function usergenerateHtml(user, profilePic, lastSeenTime, lastSeenPlatform, elapsedTime, city, country, sex, education, homeTown, status, birthday, followers, friends) {
  return `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Профиль ВКонтакте</title>
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600&family=Roboto:wght@300;400;500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
  <style>
    :root {
      --primary: #4F6DF5;
      --secondary: #FF5E3A;
      --text: #2D3436;
      --bg: #F5F7FA;
      --card-bg: #FFFFFF;
      --shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
    }
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Roboto', sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
      padding: 20px;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background-image: 
        radial-gradient(circle at 10% 20%, rgba(79, 109, 245, 0.1) 0%, transparent 20%),
        radial-gradient(circle at 90% 80%, rgba(255, 94, 58, 0.1) 0%, transparent 20%);
    }
    
    .profile-card {
      width: 100%;
      max-width: 400px;
      background: var(--card-bg);
      border-radius: 16px;
      box-shadow: var(--shadow);
      overflow: hidden;
      transition: transform 0.3s ease, box-shadow 0.3s ease;
      margin-bottom: 30px;
    }
    
    .profile-card:hover {
      transform: translateY(-5px);
      box-shadow: 0 15px 35px rgba(0, 0, 0, 0.15);
    }
    
    .profile-header {
      background: linear-gradient(135deg, var(--primary), var(--secondary));
      padding: 30px 20px;
      text-align: center;
      color: white;
      position: relative;
    }
    
    .avatar {
      width: 100px;
      height: 100px;
      border-radius: 50%;
      border: 4px solid white;
      object-fit: cover;
      margin-bottom: 15px;
      box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
      transition: transform 0.3s ease;
    }
    
    .avatar:hover {
      transform: scale(1.05);
    }
    
    .profile-name {
      font-family: 'Montserrat', sans-serif;
      font-weight: 600;
      font-size: 22px;
      margin-bottom: 5px;
    }
    
    .profile-status {
      font-size: 14px;
      opacity: 0.9;
      font-weight: 300;
    }
    
    .profile-body {
      padding: 25px;
    }
    
    .info-section {
      margin-bottom: 20px;
    }
    
    .section-title {
      font-family: 'Montserrat', sans-serif;
      font-weight: 500;
      font-size: 16px;
      color: var(--primary);
      margin-bottom: 10px;
      display: flex;
      align-items: center;
    }
    
    .section-title i {
      margin-right: 8px;
      font-size: 18px;
    }
    
    .info-item {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid rgba(0, 0, 0, 0.05);
    }
    
    .info-label {
      font-weight: 500;
      color: var(--text);
      opacity: 0.7;
    }
    
    .info-value {
      font-weight: 400;
      text-align: right;
      color: var(--text);
    }
    
    .social-stats {
      display: flex;
      justify-content: space-around;
      margin-top: 20px;
      text-align: center;
    }
    
    .stat-item {
      padding: 10px;
    }
    
    .stat-number {
      font-family: 'Montserrat', sans-serif;
      font-weight: 600;
      font-size: 18px;
      color: var(--primary);
    }
    
    .stat-label {
      font-size: 12px;
      opacity: 0.7;
    }
    
    footer {
      text-align: center;
      font-size: 14px;
      color: var(--text);
      opacity: 0.7;
      margin-top: auto;
      padding: 20px 0;
    }
    
    footer a {
      color: var(--primary);
      text-decoration: none;
      font-weight: 500;
      transition: color 0.3s ease;
    }
    
    footer a:hover {
      color: var(--secondary);
    }
    
    .online-status {
      position: absolute;
      top: 15px;
      right: 15px;
      background: rgba(255, 255, 255, 0.2);
      padding: 5px 10px;
      border-radius: 20px;
      font-size: 12px;
      display: flex;
      align-items: center;
    }
    
    .online-dot {
      width: 8px;
      height: 8px;
      background: #00E676;
      border-radius: 50%;
      margin-right: 5px;
    }
    
    @media (max-width: 480px) {
      .profile-card {
        max-width: 100%;
      }
      
      .profile-header {
        padding: 25px 15px;
      }
      
      .avatar {
        width: 80px;
        height: 80px;
      }
    }
  </style>
</head>
<body>
  <div class="profile-card">
    <div class="profile-header">
      <div class="online-status">
        <span class="online-dot"></span>
        Онлайн
      </div>
      <img src="${profilePic}" class="avatar" alt="Фото профиля">
      <h1 class="profile-name">${user.first_name} ${user.last_name}</h1>
      <p class="profile-status">${status || 'Нет статуса'}</p>
    </div>
    
    <div class="profile-body">
      <div class="info-section">
        <h3 class="section-title"><i class="fas fa-user-circle"></i> Основная информация</h3>
        <div class="info-item">
          <span class="info-label">Пол</span>
          <span class="info-value">${sex}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Дата рождения</span>
          <span class="info-value">${birthday}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Город</span>
          <span class="info-value">${city}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Страна</span>
          <span class="info-value">${country}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Родной город</span>
          <span class="info-value">${homeTown || 'Не указан'}</span>
        </div>
      </div>
      
      <div class="info-section">
        <h3 class="section-title"><i class="fas fa-graduation-cap"></i> Образование</h3>
        <div class="info-value" style="text-align: left; padding: 8px 0;">
          ${education || 'Не указано'}
        </div>
      </div>
      
      <div class="info-section">
        <h3 class="section-title"><i class="fas fa-clock"></i> Активность</h3>
        <div class="info-item">
          <span class="info-label">Последний вход</span>
          <span class="info-value">${lastSeenTime} (${elapsedTime})</span>
        </div>
        <div class="info-item">
          <span class="info-label">Устройство</span>
          <span class="info-value">${lastSeenPlatform}</span>
        </div>
      </div>
      
      <div class="social-stats">
        <div class="stat-item">
          <div class="stat-number">${friends}</div>
          <div class="stat-label">Друзей</div>
        </div>
        <div class="stat-item">
          <div class="stat-number">${followers}</div>
          <div class="stat-label">Подписчиков</div>
        </div>
      </div>
    </div>
  </div>
  
  <footer>
    Developer INK
  </footer>
</body>
</html>`; 
}

//📌 команда /gifo 
bot.onText(/\/ginfo (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  let groupId = match[1].trim(); // Убираем лишние пробелы

  // Паттерн для проверки ссылки на ВКонтакте
  const vkUrlPattern = /(?:https?:\/\/)?(?:www\.)?vk\.com\/(club|public|event)?(\d+|[a-zA-Z0-9_.-]+)/;
  const matchResult = groupId.match(vkUrlPattern);

  if (matchResult) {
    groupId = matchResult[2] || matchResult[1];
    
    if (isNaN(groupId)) {
      try {
        const resolveResponse = await axios.get("https://api.vk.com/method/utils.resolveScreenName", {
          params: {
            screen_name: groupId,
            access_token: process.env.VK_ACCESS_TOKEN,
            v: "5.199",
          },
        });

        if (resolveResponse.data.error) {
          return bot.sendMessage(chatId, `❌ Ошибка VK API: ${resolveResponse.data.error.error_msg}`);
        }

        const resolved = resolveResponse.data.response;
        if (!resolved || resolved.type !== "group") {
          return bot.sendMessage(chatId, "❌ Группа не найдена или указан неверный тип ссылки.");
        }

        groupId = resolved.object_id;
      } catch (error) {
        return bot.sendMessage(chatId, "⚠ Ошибка при разрешении короткого имени. Проверьте правильность ссылки.");
      }
    }
  }

  try {
    const groupResponse = await axios.get("https://api.vk.com/method/groups.getById", {
      params: {
        group_id: groupId,
        fields: "photo_200,city,description,members_count,verified,cover,website",
        access_token: process.env.VK_ACCESS_TOKEN,
        v: "5.199",
      },
    });

    if (groupResponse.data.error) {
      return bot.sendMessage(chatId, `❌ Ошибка VK API: ${groupResponse.data.error.error_msg}`);
    }

    const group = groupResponse.data.response?.groups?.[0];  // Извлекаем объект из массива groups

    if (!group) {
      return bot.sendMessage(chatId, "❌ Сообщество не найдено. Проверьте правильность ID или ссылки.");
    }

    // Генерация HTML содержимого
    const htmlContent = groupgenerateHtml(group);

    // Укажите путь для сохранения HTML файла
    const filePath = path.join(__dirname, 'group_info.html');

    // Сохраняем HTML файл
    fs.writeFileSync(filePath, htmlContent);

    // Отправляем HTML файл в Telegram
    bot.sendDocument(chatId, filePath, { caption: 'Вот информация о группе!' })
      .then(() => {
        // Удаляем файл после отправки
        fs.unlinkSync(filePath);
      })
      .catch((error) => {
        console.error(error);
        bot.sendMessage(chatId, '❌ Ошибка при отправке файла.');
      });

  } catch (error) {
    console.error("Ошибка при запросе к API ВКонтакте:", error);
    bot.sendMessage(chatId, "⚠ Ошибка при получении данных о сообществе. Проверьте правильность ссылки или ID.");
  }
});

// Функция для генерации HTML содержимого
function groupgenerateHtml(group) {
  return `
  <!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Информация о группе ВКонтакте</title>
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600&family=Roboto:wght@300;400;500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
  <style>
    :root {
      --primary: #5181B8; /* VK blue */
      --secondary: #FF5E3A;
      --text: #2D3436;
      --bg: #F5F7FA;
      --card-bg: #FFFFFF;
      --shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
      --verified: #4BB34B;
    }
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Roboto', sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
      padding: 20px;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background-image: 
        radial-gradient(circle at 10% 20%, rgba(81, 129, 184, 0.1) 0%, transparent 20%),
        radial-gradient(circle at 90% 80%, rgba(255, 94, 58, 0.1) 0%, transparent 20%);
    }
    
    .group-card {
      width: 100%;
      max-width: 450px;
      background: var(--card-bg);
      border-radius: 16px;
      box-shadow: var(--shadow);
      overflow: hidden;
      transition: transform 0.3s ease, box-shadow 0.3s ease;
      margin-bottom: 30px;
    }
    
    .group-card:hover {
      transform: translateY(-5px);
      box-shadow: 0 15px 35px rgba(0, 0, 0, 0.15);
    }
    
    .group-header {
      background: linear-gradient(135deg, var(--primary), #3a6ea5);
      padding: 30px 20px;
      text-align: center;
      color: white;
      position: relative;
    }
    
    .group-avatar {
      width: 100px;
      height: 100px;
      border-radius: 12px;
      border: 4px solid white;
      object-fit: cover;
      margin-bottom: 15px;
      box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
      transition: transform 0.3s ease;
    }
    
    .group-avatar:hover {
      transform: scale(1.05);
    }
    
    .group-name {
      font-family: 'Montserrat', sans-serif;
      font-weight: 600;
      font-size: 22px;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .verified-badge {
      margin-left: 8px;
      color: var(--verified);
      font-size: 18px;
    }
    
    .group-body {
      padding: 25px;
    }
    
    .info-section {
      margin-bottom: 20px;
    }
    
    .section-title {
      font-family: 'Montserrat', sans-serif;
      font-weight: 500;
      font-size: 16px;
      color: var(--primary);
      margin-bottom: 10px;
      display: flex;
      align-items: center;
    }
    
    .section-title i {
      margin-right: 8px;
      font-size: 18px;
    }
    
    .info-item {
      display: flex;
      justify-content: space-between;
      padding: 10px 0;
      border-bottom: 1px solid rgba(0, 0, 0, 0.05);
    }
    
    .info-label {
      font-weight: 500;
      color: var(--text);
      opacity: 0.7;
      flex: 1;
    }
    
    .info-value {
      font-weight: 400;
      text-align: right;
      color: var(--text);
      flex: 1.5;
    }
    
    .description {
      padding: 15px;
      background: rgba(81, 129, 184, 0.05);
      border-radius: 8px;
      margin-top: 20px;
      font-size: 14px;
      line-height: 1.5;
    }
    
    .members-count {
      display: inline-block;
      background: var(--primary);
      color: white;
      padding: 8px 15px;
      border-radius: 20px;
      font-weight: 500;
      margin-top: 10px;
    }
    
    .website-link {
      color: var(--primary);
      text-decoration: none;
      transition: color 0.3s ease;
      word-break: break-all;
    }
    
    .website-link:hover {
      color: var(--secondary);
      text-decoration: underline;
    }
    
    footer {
      text-align: center;
      font-size: 14px;
      color: var(--text);
      opacity: 0.7;
      margin-top: auto;
      padding: 20px 0;
    }
    
    footer a {
      color: var(--primary);
      text-decoration: none;
      font-weight: 500;
      transition: color 0.3s ease;
    }
    
    footer a:hover {
      color: var(--secondary);
    }
    
    @media (max-width: 480px) {
      .group-card {
        max-width: 100%;
      }
      
      .group-header {
        padding: 25px 15px;
      }
      
      .group-avatar {
        width: 80px;
        height: 80px;
      }
      
      .group-name {
        font-size: 20px;
      }
    }
  </style>
</head>
<body>
  <div class="group-card">
    <div class="group-header">
      <img src="${group.photo_200}" class="group-avatar" alt="Фото группы">
      <h1 class="group-name">
        ${group.name}
        ${group.verified ? '<span class="verified-badge"><i class="fas fa-check-circle"></i></span>' : ''}
      </h1>
    </div>
    
    <div class="group-body">
      <div class="info-section">
        <h3 class="section-title"><i class="fas fa-info-circle"></i> Основная информация</h3>
        <div class="info-item">
          <span class="info-label">Город</span>
          <span class="info-value">${group.city?.title || "Не указан"}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Верификация</span>
          <span class="info-value">
            ${group.verified ? '<span style="color: var(--verified);"><i class="fas fa-check"></i> Подтверждена</span>' : '<span style="color: #FF4757;"><i class="fas fa-times"></i> Не подтверждена</span>'}
          </span>
        </div>
      </div>
      
      <div class="info-section">
        <h3 class="section-title"><i class="fas fa-users"></i> Участники</h3>
        <div style="text-align: center;">
          <span class="members-count">
            <i class="fas fa-user-friends"></i> ${group.members_count || "0"} участников
          </span>
        </div>
      </div>
      
      ${group.description ? `
      <div class="info-section">
        <h3 class="section-title"><i class="fas fa-align-left"></i> Описание</h3>
        <div class="description">
          ${group.description}
        </div>
      </div>
      ` : ''}
      
      ${group.website ? `
      <div class="info-section">
        <h3 class="section-title"><i class="fas fa-globe"></i> Вебсайт</h3>
        <div style="text-align: center; margin-top: 10px;">
          <a href="${group.website.startsWith('http') ? group.website : 'https://' + group.website}" 
             class="website-link" 
             target="_blank">
            <i class="fas fa-external-link-alt"></i> ${group.website}
          </a>
        </div>
      </div>
      ` : ''}
    </div>
  </div>
  
  <footer>
    Developer INK
  </footer>
</body>
</html>`;
}

//📌 команда участники 
function usergroupgenerateHtml(members) {
  const membersHtml = members.map(member => `
    <div class="friend">
      <img src="${member.photo_100}" class="avatar" alt="Фото">
      <div class="friend-info">${member.first_name} ${member.last_name}</div>
    </div>
  `).join('');

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Список участников группы</title>
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600&family=Roboto:wght@300;400;500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
  <style>
    :root {
      --primary: #5181B8;
      --secondary: #FF5E3A;
      --text: #2D3436;
      --bg: #F5F7FA;
      --card-bg: #FFFFFF;
      --shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
      --online: #4BB34B;
      --offline: #99A2AD;
    }
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Roboto', sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
      padding: 20px;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      background-image: 
        radial-gradient(circle at 10% 20%, rgba(81, 129, 184, 0.1) 0%, transparent 20%),
        radial-gradient(circle at 90% 80%, rgba(255, 94, 58, 0.1) 0%, transparent 20%);
    }
    
    .members-container {
      width: 100%;
      max-width: 500px;
      background: var(--card-bg);
      border-radius: 16px;
      box-shadow: var(--shadow);
      overflow: hidden;
      margin-bottom: 30px;
    }
    
    .members-header {
      background: linear-gradient(135deg, var(--primary), #3a6ea5);
      padding: 20px;
      text-align: center;
      color: white;
    }
    
    .members-title {
      font-family: 'Montserrat', sans-serif;
      font-weight: 600;
      font-size: 22px;
      margin: 0;
    }
    
    .members-list {
      padding: 15px 20px;
      max-height: 500px;
      overflow-y: auto;
    }
    
    .member-card {
      display: flex;
      align-items: center;
      padding: 10px;
      margin-bottom: 10px;
      background: rgba(81, 129, 184, 0.05);
      border-radius: 10px;
      transition: all 0.3s ease;
    }
    
    .member-card:hover {
      background: rgba(81, 129, 184, 0.1);
      transform: translateX(5px);
    }
    
    .member-avatar {
      width: 50px;
      height: 50px;
      border-radius: 50%;
      object-fit: cover;
      margin-right: 15px;
      border: 2px solid #e1e3e6;
    }
    
    .member-name {
      font-family: 'Montserrat', sans-serif;
      font-weight: 500;
      font-size: 16px;
      color: var(--text);
    }
    
    footer {
      text-align: center;
      font-size: 14px;
      color: var(--text);
      opacity: 0.7;
      margin-top: auto;
      padding: 20px 0;
    }
    
    footer a {
      color: var(--primary);
      text-decoration: none;
      font-weight: 500;
    }
    
    .empty-state {
      text-align: center;
      padding: 30px;
      color: #656565;
    }
    
    .empty-state i {
      font-size: 40px;
      margin-bottom: 15px;
      color: #d3d3d3;
    }
    
    @media (max-width: 480px) {
      .members-container {
        max-width: 100%;
      }
      
      .member-avatar {
        width: 40px;
        height: 40px;
        margin-right: 10px;
      }
      
      .member-name {
        font-size: 14px;
      }
    }
  </style>
</head>
<body>
  <div class="members-container">
    <div class="members-header">
      <h1 class="members-title">Участники группы</h1>
    </div>
    
    <div class="members-list">
      ${membersHtml || `
        <div class="empty-state">
          <i class="fas fa-user-slash"></i>
          <p>Нет участников для отображения</p>
        </div>
      `}
    </div>
  </div>
  
  <footer>
    Developer INK
  </footer>
</body>
</html>`;
}

// Команда /участники
bot.onText(/\/участники (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  let groupId = match[1];

  // Если передана ссылка, извлекаем короткое имя группы
  if (groupId.includes("vk.com/")) {
    groupId = groupId.split("/").pop();
  }

  try {
    // Получаем список участников группы
    const response = await axios.get("https://api.vk.com/method/groups.getMembers", {
      params: {
        group_id: groupId,
        fields: "first_name,last_name,photo_100",
        access_token: process.env.VK_ACCESS_TOKEN,
        v: "5.131"
      }
    });

    if (response.data.error) {
      bot.sendMessage(chatId, `Ошибка: ${response.data.error.error_msg}`);
      return;
    }

    const members = response.data.response.items;

    if (!members.length) {
      bot.sendMessage(chatId, "В группе нет участников или она скрыта.");
      return;
    }

    // Генерируем HTML
    const htmlContent = usergroupgenerateHtml(members);
    const filePath = `members_${groupId}.html`;

    // Сохраняем в файл
    fs.writeFileSync(filePath, htmlContent, "utf8");

    // Отправляем файл пользователю
    bot.sendDocument(chatId, filePath, { caption: "Список участников группы" })
      .then(() => fs.unlinkSync(filePath))  // Удаляем файл после отправки
      .catch(err => console.error("Ошибка при отправке файла:", err));

  } catch (error) {
    console.error(error);
    bot.sendMessage(chatId, "Ошибка при получении списка участников.");
  }
});

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
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600&family=Roboto:wght@300;400;500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
  <style>
    :root {
      --primary: #5181B8;
      --secondary: #FF5E3A;
      --text: #2D3436;
      --bg: #F5F7FA;
      --card-bg: #FFFFFF;
      --shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
      --online: #4BB34B;
      --offline: #99A2AD;
    }
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Roboto', sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
      padding: 20px;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      background-image: 
        radial-gradient(circle at 10% 20%, rgba(81, 129, 184, 0.1) 0%, transparent 20%),
        radial-gradient(circle at 90% 80%, rgba(255, 94, 58, 0.1) 0%, transparent 20%);
    }
    
    .friends-container {
      width: 100%;
      max-width: 500px;
      background: var(--card-bg);
      border-radius: 16px;
      box-shadow: var(--shadow);
      overflow: hidden;
      margin-bottom: 30px;
    }
    
    .friends-header {
      background: linear-gradient(135deg, var(--primary), #3a6ea5);
      padding: 20px;
      text-align: center;
      color: white;
    }
    
    .friends-title {
      font-family: 'Montserrat', sans-serif;
      font-weight: 600;
      font-size: 22px;
      margin: 0;
    }
    
    .friends-list {
      padding: 15px 20px;
      max-height: 500px;
      overflow-y: auto;
    }
    
    .friend-card {
      display: flex;
      align-items: center;
      padding: 12px 15px;
      margin-bottom: 10px;
      background: rgba(81, 129, 184, 0.05);
      border-radius: 10px;
      transition: all 0.3s ease;
    }
    
    .friend-card:hover {
      background: rgba(81, 129, 184, 0.1);
    }
    
    .friend-avatar {
      width: 50px;
      height: 50px;
      border-radius: 50%;
      object-fit: cover;
      margin-right: 15px;
      border: 2px solid #e1e3e6;
    }
    
    .friend-info {
      flex: 1;
    }
    
    .friend-name {
      font-family: 'Montserrat', sans-serif;
      font-weight: 500;
      font-size: 16px;
      color: var(--text);
    }
    
    footer {
      text-align: center;
      font-size: 14px;
      color: var(--text);
      opacity: 0.7;
      margin-top: auto;
      padding: 20px 0;
    }
    
    footer a {
      color: var(--primary);
      text-decoration: none;
      font-weight: 500;
    }
    
    .empty-state {
      text-align: center;
      padding: 30px;
      color: #656565;
    }
    
    .empty-state i {
      font-size: 40px;
      margin-bottom: 15px;
      color: #d3d3d3;
    }
    
    @media (max-width: 480px) {
      .friends-container {
        max-width: 100%;
      }
      
      .friend-avatar {
        width: 40px;
        height: 40px;
        margin-right: 10px;
      }
    }
  </style>
</head>
<body>
  <div class="friends-container">
    <div class="friends-header">
      <h1 class="friends-title">Друзья пользователя</h1>
    </div>
    
    <div class="friends-list">
      ${friendsHtml || `
        <div class="empty-state">
          <i class="fas fa-user-slash"></i>
          <p>Нет друзей для отображения</p>
        </div>
      `}
    </div>
  </div>
  
  <footer>
    Developer INK
  </footer>
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
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600&family=Roboto:wght@300;400;500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
  <style>
    :root {
      --primary: #5181B8;
      --secondary: #FF5E3A;
      --text: #2D3436;
      --bg: #F5F7FA;
      --card-bg: #FFFFFF;
      --shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
      --online: #4BB34B;
      --offline: #99A2AD;
    }
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Roboto', sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
      padding: 20px;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      background-image: 
        radial-gradient(circle at 10% 20%, rgba(81, 129, 184, 0.1) 0%, transparent 20%),
        radial-gradient(circle at 90% 80%, rgba(255, 94, 58, 0.1) 0%, transparent 20%);
    }
    
    .followers-container {
      width: 100%;
      max-width: 500px;
      background: var(--card-bg);
      border-radius: 16px;
      box-shadow: var(--shadow);
      overflow: hidden;
      margin-bottom: 30px;
    }
    
    .followers-header {
      background: linear-gradient(135deg, var(--primary), #3a6ea5);
      padding: 20px;
      text-align: center;
      color: white;
    }
    
    .followers-title {
      font-family: 'Montserrat', sans-serif;
      font-weight: 600;
      font-size: 22px;
      margin: 0;
    }
    
    .followers-list {
      padding: 15px 20px;
      max-height: 500px;
      overflow-y: auto;
    }
    
    .follower-card {
      display: flex;
      align-items: center;
      padding: 12px 15px;
      margin-bottom: 10px;
      background: rgba(81, 129, 184, 0.05);
      border-radius: 10px;
      transition: all 0.3s ease;
    }
    
    .follower-card:hover {
      background: rgba(81, 129, 184, 0.1);
      transform: translateX(5px);
    }
    
    .follower-avatar {
      width: 50px;
      height: 50px;
      border-radius: 50%;
      object-fit: cover;
      margin-right: 15px;
      border: 2px solid #e1e3e6;
    }
    
    .follower-info {
      flex: 1;
    }
    
    .follower-name {
      font-family: 'Montserrat', sans-serif;
      font-weight: 500;
      font-size: 16px;
      color: var(--text);
    }
    
    footer {
      text-align: center;
      font-size: 14px;
      color: var(--text);
      opacity: 0.7;
      margin-top: auto;
      padding: 20px 0;
    }
    
    footer a {
      color: var(--primary);
      text-decoration: none;
      font-weight: 500;
    }
    
    .empty-state {
      text-align: center;
      padding: 30px;
      color: #656565;
    }
    
    .empty-state i {
      font-size: 40px;
      margin-bottom: 15px;
      color: #d3d3d3;
    }
    
    @media (max-width: 480px) {
      .followers-container {
        max-width: 100%;
      }
      
      .follower-avatar {
        width: 40px;
        height: 40px;
        margin-right: 10px;
      }
    }
  </style>
</head>
<body>
  <div class="followers-container">
    <div class="followers-header">
      <h1 class="followers-title">Подписчики пользователя</h1>
    </div>
    
    <div class="followers-list">
      ${followersHtml || `
        <div class="empty-state">
          <i class="fas fa-user-slash"></i>
          <p>Нет подписчиков для отображения</p>
        </div>
      `}
    </div>
  </div>
  
  <footer>
    Developer INK
  </footer>
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
  <title>Подписки пользователя ВКонтакте</title>
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600&family=Roboto:wght@300;400;500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
  <style>
    :root {
      --primary: #5181B8; /* Основной цвет VK */
      --secondary: #FF5E3A;
      --text: #2D3436;
      --bg: #F5F7FA;
      --card-bg: #FFFFFF;
      --shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
      --verified: #4BB34B;
    }
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Roboto', sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
      padding: 20px;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      background-image: 
        radial-gradient(circle at 10% 20%, rgba(81, 129, 184, 0.1) 0%, transparent 20%),
        radial-gradient(circle at 90% 80%, rgba(255, 94, 58, 0.1) 0%, transparent 20%);
    }
    
    .subscriptions-container {
      width: 100%;
      max-width: 500px;
      background: var(--card-bg);
      border-radius: 16px;
      box-shadow: var(--shadow);
      overflow: hidden;
      margin-bottom: 30px;
    }
    
    .subscriptions-header {
      background: linear-gradient(135deg, var(--primary), #3a6ea5);
      padding: 20px;
      text-align: center;
      color: white;
    }
    
    .subscriptions-title {
      font-family: 'Montserrat', sans-serif;
      font-weight: 600;
      font-size: 22px;
      margin: 0;
    }
    
    .subscriptions-list {
      padding: 15px 20px;
      max-height: 500px;
      overflow-y: auto;
    }
    
    .subscription-card {
      display: flex;
      align-items: center;
      padding: 12px 15px;
      margin-bottom: 10px;
      background: rgba(81, 129, 184, 0.05);
      border-radius: 10px;
      transition: all 0.3s ease;
    }
    
    .subscription-card:hover {
      background: rgba(81, 129, 184, 0.1);
      transform: translateX(5px);
    }
    
    .subscription-avatar {
      width: 50px;
      height: 50px;
      border-radius: 12px; /* Квадратные с закруглением для групп */
      object-fit: cover;
      margin-right: 15px;
      border: 2px solid #e1e3e6;
    }
    
    .subscription-info {
      flex: 1;
    }
    
    .subscription-name {
      font-family: 'Montserrat', sans-serif;
      font-weight: 500;
      font-size: 16px;
      margin-bottom: 3px;
      display: flex;
      align-items: center;
    }
    
    .verified-badge {
      margin-left: 5px;
      color: var(--verified);
      font-size: 14px;
    }
    
    .subscription-type {
      font-size: 13px;
      color: #656565;
    }
    
    footer {
      text-align: center;
      font-size: 14px;
      color: var(--text);
      opacity: 0.7;
      margin-top: auto;
      padding: 20px 0;
    }
    
    footer a {
      color: var(--primary);
      text-decoration: none;
      font-weight: 500;
      transition: color 0.3s ease;
    }
    
    footer a:hover {
      color: var(--secondary);
    }
    
    .empty-state {
      text-align: center;
      padding: 30px;
      color: #656565;
    }
    
    .empty-state i {
      font-size: 40px;
      margin-bottom: 15px;
      color: #d3d3d3;
    }
    
    @media (max-width: 480px) {
      .subscriptions-container {
        max-width: 100%;
      }
      
      .subscription-avatar {
        width: 40px;
        height: 40px;
        margin-right: 10px;
      }
    }
  </style>
</head>
<body>
  <div class="subscriptions-container">
    <div class="subscriptions-header">
      <h1 class="subscriptions-title">Подписки пользователя</h1>
    </div>
    
    <div class="subscriptions-list">
      ${subscriptionsHtml || `
        <div class="empty-state">
          <i class="fas fa-bell-slash"></i>
          <p>Нет подписок для отображения</p>
        </div>
      `}
    </div>
  </div>
  
  <footer>
    Developer INK
  </footer>
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
// Регистрируем шрифты
try {
  registerFont('C:\\Windows\\Fonts\\arial.ttf', { family: 'Arial' });
  registerFont('C:\\Windows\\Fonts\\arialbd.ttf', { family: 'Arial', weight: 'bold' });
} catch (err) {
  console.warn('Не удалось зарегистрировать шрифты, будут использованы стандартные');
}

bot.onText(/\/photo (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const vkId = match[1];

  // Функции для обработки данных
  const getElapsedTime = (lastSeenTime) => {
    if (!lastSeenTime) return "Неизвестно";
    const now = Math.floor(Date.now() / 1000);
    const diff = now - lastSeenTime;
    const intervals = [
      { label: 'год', seconds: 31536000 },
      { label: 'мес', seconds: 2592000 },
      { label: 'дн', seconds: 86400 },
      { label: 'ч', seconds: 3600 },
      { label: 'мин', seconds: 60 }
    ];
    for (const interval of intervals) {
      const count = Math.floor(diff / interval.seconds);
      if (count >= 1) return `${count} ${interval.label}. назад`;
    }
    return "Только что";
  };

  const getPlatformName = (platformId) => {
    const platforms = {
      1: "Мобильная версия", 2: "iPhone", 3: "iPad", 
      4: "Android", 5: "Windows Phone", 6: "ПК", 
      7: "VK Mobile", 8: "VK для Windows"
    };
    return platforms[platformId] || "Неизвестно";
  };

  try {
    const [user] = await vk.api.users.get({
      user_ids: vkId,
      fields: 'photo_max_orig,last_seen,counters,city,verified,status,site,sex,' +
              'relation,bdate,has_mobile,is_closed,wall_comments,blacklisted'
    });

    if (!user) {
      return bot.sendMessage(chatId, "❌ Профиль не найден");
    }

    // Получаем все данные
    const avatarUrl = user.photo_max_orig;
    const lastSeenTime = user.last_seen ? getElapsedTime(user.last_seen.time) : "Неизвестно";
    const friendsCount = user.counters?.friends || 0;
    const followersCount = user.counters?.followers || 0;
    const city = user.city ? user.city.title : "Не указан";
    const verified = user.verified ? "✅ Да" : "❌ Нет";
    const online = user.online ? "🟢 Онлайн" : "🔴 Оффлайн";
    const device = user.last_seen ? getPlatformName(user.last_seen.platform) : "Неизвестно";
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

    // Создаем изображение
    const canvasWidth = 1000;
    const canvasHeight = 1500;
    const canvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d');

    // Фон
    const gradient = ctx.createLinearGradient(0, 0, canvasWidth, canvasHeight);
    gradient.addColorStop(0, '#1e3c72');
    gradient.addColorStop(1, '#2a5298');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Аватар
    try {
      const avatar = await loadImage(avatarUrl);
      ctx.save();
      ctx.beginPath();
      ctx.arc(150, 150, 120, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(avatar, 30, 30, 240, 240);
      ctx.restore();
      
      // Рамка
      ctx.beginPath();
      ctx.arc(150, 150, 120, 0, Math.PI * 2);
      ctx.lineWidth = 5;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
    } catch (e) {
      console.error('Ошибка загрузки аватарки:', e);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(150, 150, 120, 0, Math.PI * 2);
      ctx.fill();
    }

    // Текст
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 42px Arial';
    ctx.fillText(`${user.first_name} ${user.last_name}`, 350, 150);

    // Функция для добавления текста
    let yPos = 220;
    const addTextLine = (label, value, icon = '') => {
      ctx.font = 'bold 28px Arial';
      ctx.fillText(`${icon} ${label}:`, 350, yPos);
      ctx.font = '28px Arial';
      ctx.fillText(value, 650, yPos);
      yPos += 40;
    };

    // Основная информация
    addTextLine('Город', city, '🏙');
    addTextLine('Статус', status, '🏷');
    addTextLine('Онлайн', online, '🔵');
    addTextLine('Последний вход', lastSeenTime, '⏱');
    addTextLine('Устройство', device, '📱');
    addTextLine('Пол', sex, '👤');
    addTextLine('Дата рождения', bdate, '🎂');
    addTextLine('Телефон', hasMobile, '📞');
    addTextLine('Верификация', verified, '✅');
    addTextLine('Профиль', isClosed, '🔐');
    addTextLine('Комментарии', wallComments, '💬');
    addTextLine('В ЧС', blacklisted, '🚫');
    addTextLine('Сайт', site, '🌐');
    addTextLine('Отношения', relation, '💑');

    // Статистика
    yPos += 20;
    ctx.font = 'bold 32px Arial';
    ctx.fillText('📊 Статистика:', 350, yPos);
    yPos += 40;

    addTextLine('Друзья', friendsCount, '👫');
    addTextLine('Подписчики', followersCount, '👥');
    addTextLine('Фотографии', photosCount, '📸');
    addTextLine('Видео', videosCount, '🎥');
    addTextLine('Подарки', giftsCount, '🎁');
    addTextLine('Записи', wallPostsCount, '📝');

    // Добавляем подпись "Developer by INK" внизу изображения
   ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'; // Полупрозрачный белый
   ctx.font = 'italic 24px Arial';
   const signatureText = 'Developer by INK';
   const textWidth = ctx.measureText(signatureText).width;
   ctx.fillText(signatureText, canvasWidth - textWidth - 40, canvasHeight - 30);

    // Сохраняем и отправляем изображение
    const tempFile = path.join(os.tmpdir(), `vk_profile_${Date.now()}.png`);
    const out = fs.createWriteStream(tempFile);
    const stream = canvas.createPNGStream();

    await new Promise((resolve, reject) => {
      stream.pipe(out);
      out.on('finish', resolve);
      out.on('error', reject);
    });

    await bot.sendPhoto(chatId, tempFile, {
      caption: `📋 Профиль ${user.first_name} ${user.last_name}`,
      parse_mode: 'Markdown'
    });

    fs.unlink(tempFile, () => {});

  } catch (error) {
    console.error('Ошибка:', error);
    await bot.sendMessage(chatId, '❌ Ошибка при создании профиля');
  }
});

//📌 команда settings
let isLoggingEnabled = false;  // Переменная для включения/выключения логов

// Функция для отправки информации для разработчиков во всплывающем окне
async function sendDeveloperInfo(chatId) {
  const developerInfo = 
    `🛠 Информация для разработчиков:
    Этот бот был написан для личных целей. Создатель не несет ответственности, если ваш аккаунт ВКонтакте будет заблокирован из-за запрета на использование шпионских программ!

    Если вы вносите изменения в код бота и готовитесь к публикации, укажите автора: INK.
    `;
  
  bot.sendMessage(chatId, developerInfo);  // Отправка сообщения через Telegram API
  
  if (isLoggingEnabled) console.log(`Команда отправки информации для разработчиков выполнена для чата ${chatId}`);
}

// Функция для получения информации о пользователе ВКонтакте
async function getVkUserInfo() {
  try {
    const response = await vk.api.users.get({ access_token: process.env.VK_ACCESS_TOKEN });
    if (isLoggingEnabled) console.log('Запрос к VK API: Получение информации о пользователе');
    return response[0]; // Возвращаем данные о пользователе
  } catch (error) {
    if (isLoggingEnabled) console.error('Ошибка при получении данных о пользователе ВКонтакте:', error);
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
      if (isLoggingEnabled) console.log('Токен ВКонтакте действителен');
      return true;  // Токен действителен
    } else {
      if (isLoggingEnabled) console.log('Токен ВКонтакте не действителен');
      return false;  // Токен не действителен
    }
  } catch (error) {
    if (isLoggingEnabled) console.error('Ошибка при проверке токена:', error);
    return false;  // Токен не действителен
  }
}

// Функция для получения нагрузки на процессор и память
async function getSystemLoad() {
  const cpuUsage = await new Promise((resolve) => osu.cpuUsage(resolve));
  const memoryUsage = osu.freememPercentage() * 100; // Свободная память в процентах
  return {
    cpu: cpuUsage.toFixed(2),
    memory: (100 - memoryUsage).toFixed(2) // Занятая память в процентах
  };
}
// Функция для получения информации о пинге бота
async function getBotPing() {
  const startTime = Date.now();
  await bot.getMe();  // Пинг бота
  const ping = Date.now() - startTime;
  return ping;
}

// Функция для получения информации об операционной системе
function getSystemInfo() {
  const platform = os.platform();  // Платформа операционной системы (например, 'linux', 'win32', 'darwin')
  const arch = os.arch();  // Архитектура системы (например, 'x64')
  const osType = os.type();  // Тип ОС (например, 'Linux', 'Darwin', 'Windows_NT')
  const osRelease = os.release();  // Версия ОС
  const hostname = os.hostname();  // Имя хоста
  const uptime = os.uptime();  // Время работы системы в секундах

  return {
    platform,
    arch,
    osType,
    osRelease,
    hostname,
    uptime: moment.duration(uptime, 'seconds').humanize(),  // Время работы в человекочитаемом формате
  };
}
// Основной обработчик для команды /settings
bot.onText(/\/settings/, async (msg) => {
  const chatId = msg.chat.id;

  // Логирование команды /settings
  if (isLoggingEnabled) console.log(`Команда /settings выполнена пользователем ${chatId}`);

  // Проверка, что команду может выполнить только администратор
  if (!allowedAdmins.includes(chatId)) {
    return bot.sendMessage(chatId, '❌ У вас нет прав для использования этой команды.');
  }

  const uptime = moment.duration(process.uptime(), 'seconds').humanize();  // Время работы бота
  const startTime = moment().format('DD-MM-YYYY HH:mm:ss');  // Дата и время запуска
  const vkUserInfo = await getVkUserInfo();
  const vkTokenValid = await checkVkToken() ? "✅ Токен ВКонтакте действителен" : "❌ Токен ВКонтакте не действителен";
  const systemLoad = await getSystemLoad();  // Получаем нагрузку на систему
  const botPing = await getBotPing();  // Получаем пинг бота
  const systemInfo = getSystemInfo();  // Получаем информацию об ОС

  const settingsMessage = `
    🔧 Настройки бота:
    - Время работы: ${uptime}
    - Дата и время запуска: ${startTime}
    - Владелец токена (ВКонтакте): ${vkUserInfo ? vkUserInfo.first_name + " " + vkUserInfo.last_name : "Не удалось получить данные"}
    - Статус токена ВКонтакте: ${vkTokenValid}
    - Нагрузка на процессор: ${systemLoad.cpu}%
    - Нагрузка на память: ${systemLoad.memory}%
    - Пинг бота: ${botPing}ms
    - Операционная система:
      - Платформа: ${systemInfo.platform}
      - Архитектура: ${systemInfo.arch}
      - Тип ОС: ${systemInfo.osType}
      - Версия ОС: ${systemInfo.osRelease}
      - Имя хоста: ${systemInfo.hostname}
      - Время работы системы: ${systemInfo.uptime}
    - Разработчик INK
  `;

  const options = {
    reply_markup: {
      inline_keyboard: [
        [{ text: "✅ Перезапустить бота", callback_data: 'restart' }],
        [{ text: "🛠 Информация для разработчиков", callback_data: 'developer_info' }],
        [{ text: "🔍 Проверить токен ВКонтакте", callback_data: 'check_token' }],
        [{ text: "🔗 Код на GitHub", url: "https://github.com/inkoson007/TELEGRAM-BOT-INFO-VK-PROFILE" }],
        [{ text: isLoggingEnabled ? "❌ Отключить логи" : "✅ Включить логи", callback_data: 'toggle_logs' }] // Кнопка для включения/выключения логов
      ]
    }
  };

  bot.sendMessage(chatId, settingsMessage, options);

  if (isLoggingEnabled) console.log(`Отправлена информация о настройках в чат ${chatId}`);
});

// Обработка нажатий на кнопки
bot.on('callback_query', async (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;

  // Логирование всех нажатий на кнопки
  if (isLoggingEnabled) console.log(`Команда с кнопки выполнена для чата ${chatId}: ${data}`);

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

    if (isLoggingEnabled) console.log(`Перезапуск бота выполнен для чата ${chatId}`);
  }

  if (data === 'developer_info') {
    sendDeveloperInfo(chatId);
  }

  if (data === 'check_token') {
    const vkTokenValid = await checkVkToken() ? "✅ Токен ВКонтакте действителен" : "❌ Токен ВКонтакте не действителен";
    bot.sendMessage(chatId, `Статус токена ВКонтакте: ${vkTokenValid}`);
  }

  if (data === 'toggle_logs') {
    isLoggingEnabled = !isLoggingEnabled;  // Переключаем состояние логирования
    const logStatusMessage = isLoggingEnabled ? "✅ Логи включены" : "❌ Логи отключены";
    bot.sendMessage(chatId, logStatusMessage);
    if (isLoggingEnabled) console.log('Логи включены');
    else console.log('Логи отключены');
  }

  bot.answerCallbackQuery(callbackQuery.id);
});

//📌 команда id
// Функция для получения ID пользователя по ссылке на профиль ВКонтакте
async function getVkUserId(profileUrl) {
  try {
    // Извлекаем имя пользователя из ссылки
    const usernameMatch = profileUrl.match(/vk\.com\/([a-zA-Z0-9_.]+)/);
    if (!usernameMatch) return null;

    const username = usernameMatch[1];

    // Запрос к API VK для получения ID
    const response = await axios.get('https://api.vk.com/method/users.get', {
      params: {
        user_ids: username,
        access_token: process.env.VK_ACCESS_TOKEN, // Используем токен из переменных окружения
        v: '5.131',
      },
    });

    if (response.data.response && response.data.response.length > 0) {
      return response.data.response[0].id; // Возвращаем ID пользователя
    } else {
      return null;
    }
  } catch (error) {
    console.error('Ошибка при получении ID пользователя:', error);
    return null;
  }
}

// Обработчик команды /id
bot.onText(/\/id (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const profileUrl = match[1].trim();

  bot.sendMessage(chatId, '⏳ Получаем ID профиля...');

  const userId = await getVkUserId(profileUrl);

  if (userId) {
    bot.sendMessage(chatId, `✅ ID данного профиля ВКонтакте: ${userId}`);
  } else {
    bot.sendMessage(chatId, '❌ Не удалось получить ID. Проверьте правильность ссылки.');
  }
});

//📌 команда gid
bot.onText(/\/gid (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  let groupUrl = match[1].trim(); // Убираем пробелы

  // Регулярное выражение для извлечения короткого имени группы
  const vkUrlPattern = /(?:https?:\/\/)?(?:www\.)?vk\.com\/([a-zA-Z0-9_.-]+)/;
  const matchResult = groupUrl.match(vkUrlPattern);

  if (!matchResult) {
    return bot.sendMessage(chatId, "❌ Пожалуйста, укажите корректную ссылку на группу ВКонтакте.");
  }

  let screenName = matchResult[1]; // Извлекаем короткое имя группы

  try {
    // Первый запрос: получаем информацию через resolveScreenName
    const resolveResponse = await axios.get("https://api.vk.com/method/utils.resolveScreenName", {
      params: {
        screen_name: screenName,
        access_token: process.env.VK_ACCESS_TOKEN, // Убедитесь, что у вас есть токен
        v: "5.199",
      },
    });

    if (resolveResponse.data.error) {
      return bot.sendMessage(chatId, `❌ Ошибка VK API: ${resolveResponse.data.error.error_msg}`);
    }

    const resolved = resolveResponse.data.response;
    if (!resolved || resolved.type !== "group") {
      return bot.sendMessage(chatId, "❌ Группа не найдена или указан неверный тип ссылки.");
    }

    const groupId = resolved.object_id;

    bot.sendMessage(chatId, `✅ ID группы: ${groupId}`);
  } catch (error) {
    console.error(error);
    bot.sendMessage(chatId, "⚠ Ошибка при запросе к API ВКонтакте.");
  }
});

//📌 команда statistic
// Создание таблицы, если ее нет
db.run(`CREATE TABLE IF NOT EXISTS friends (
  user_id INTEGER,
  friend_id INTEGER,
  first_name TEXT,
  last_name TEXT,
  added_at TEXT,
  removed_at TEXT,
  PRIMARY KEY (user_id, friend_id)
)`);

async function trackFriends(userId) {
  try {
    const userInfo = await vk.api.users.get({ user_ids: userId });
    const userFullName = `${userInfo[0].first_name} ${userInfo[0].last_name}`;

    const { items: friends } = await vk.api.friends.get({ user_id: userId, fields: 'nickname' });
    const currentFriends = new Map(friends.map(f => [f.id, f]));

    db.all('SELECT friend_id FROM friends WHERE user_id = ? AND removed_at IS NULL', [userId], (err, rows) => {
      if (err) return console.error(err);
      const knownFriends = new Map(rows.map(row => [row.friend_id, true]));

      // Проверяем новых друзей
      friends.forEach(friend => {
        if (!knownFriends.has(friend.id)) {
          db.run('INSERT INTO friends (user_id, friend_id, first_name, last_name, added_at) VALUES (?, ?, ?, ?, ?)',
            [userId, friend.id, friend.first_name, friend.last_name, moment().format('YYYY-MM-DD HH:mm:ss')]);
        }
      });

      // Проверяем удаленных друзей
      knownFriends.forEach((_, id) => {
        if (!currentFriends.has(id)) {
          db.run('UPDATE friends SET removed_at = ? WHERE user_id = ? AND friend_id = ?',
            [moment().format('YYYY-MM-DD HH:mm:ss'), userId, id]);
        }
      });
    });

    return userFullName;
  } catch (error) {
    console.error(`Ошибка при получении друзей для пользователя ${userId}:`, error);
    return null;
  }
}

bot.onText(/\/statistic (\d+)/, async (msg, match) => {
  const userId = match[1];
  const userFullName = await trackFriends(userId);

  if (!userFullName) {
    return bot.sendMessage(msg.chat.id, 'Ошибка при получении данных о пользователе.');
  }

  db.get('SELECT COUNT(*) AS count FROM friends WHERE user_id = ?', [userId], async (err, row) => {
    if (err) return bot.sendMessage(msg.chat.id, 'Ошибка при проверке данных.');

    if (row.count === 0) {
      bot.sendMessage(msg.chat.id, `👀 Пользователь ${userFullName} впервые в статистике. Получаю информацию...`);
    }

    // Ждем 1 секунду, чтобы база данных обновилась
    await new Promise(resolve => setTimeout(resolve, 1000));

    db.all('SELECT * FROM friends WHERE user_id = ?', [userId], async (err, rows) => {
      if (err) return bot.sendMessage(msg.chat.id, 'Ошибка при получении статистики.');

      if (rows.length === 0) {
        return bot.sendMessage(msg.chat.id, `Нет данных для пользователя ${userFullName}.`);
      }

      // Заголовок
      const title = `=====================\n Developer by INK \n=====================\n\n`;

      // Формируем текстовое сообщение
      let message = `📊 Статистика друзей пользователя ${userFullName}:\n\n`;
      let fileContent = title + `📊 Статистика друзей пользователя ${userFullName}:\n\n`;

      rows.forEach(row => {
        const friendData = `👤 ${row.first_name} ${row.last_name}\nДобавлен: ${row.added_at}\n` +
                           (row.removed_at ? `Удален: ${row.removed_at} ❌\n\n` : `В друзьях: ✅\n\n`);

        message += friendData;
        fileContent += friendData;
      });

      // Проверяем длину сообщения
      if (message.length > 4096) {
        // Если слишком длинное — создаем файл
        const fileName = `friends_stat_${userId}.txt`;
        const filePath = `./${fileName}`;
        fs.writeFileSync(filePath, fileContent);

        // Отправляем кнопку для получения файла
        const options = {
          reply_markup: JSON.stringify({
            inline_keyboard: [
              [{ text: '📂 Получить файл', callback_data: `send_file_${userId}` }]
            ]
          })
        };

        return bot.sendMessage(msg.chat.id, '⚠️ Данные слишком большие для отправки. Нажмите кнопку ниже, чтобы получить файл.', options);
      }

      // Если сообщение не длинное, просто отправляем его
      bot.sendMessage(msg.chat.id, message);
    });
  });
});

// Обработчик нажатия кнопки "Получить файл"
bot.on('callback_query', (query) => {
  if (query.data.startsWith('send_file_')) {
    const userId = query.data.split('_')[2];
    const filePath = `./friends_stat_${userId}.txt`;

    bot.sendDocument(query.message.chat.id, filePath, { caption: '📂 Ваша статистика друзей' })
      .then(() => fs.unlinkSync(filePath)) // Удаляем файл после отправки
      .catch(err => console.error('Ошибка при отправке файла:', err));
  }
});

//📌 команда like
// Функция разбиения длинного текста на части по 4000 символов
function splitMessage(text, maxLength = 4000) {
  let parts = [];
  while (text.length > maxLength) {
      let sliceIndex = text.lastIndexOf('\n', maxLength);
      if (sliceIndex === -1) sliceIndex = maxLength;
      parts.push(text.slice(0, sliceIndex));
      text = text.slice(sliceIndex);
  }
  parts.push(text);
  return parts;
}

// Функция получения имени и фамилии пользователя
async function getUserName(userId) {
  try {
      const user = await vk.api.users.get({ user_ids: userId });
      return `${user[0].first_name} ${user[0].last_name}`;
  } catch (error) {
      console.error(error);
      return `ID: ${userId}`;
  }
}

// Функция получения лайков с постов и фото
async function getLikes(userId) {
  let likesData = new Map();

  try {
      // Получаем список постов пользователя
      const wall = await vk.api.wall.get({ owner_id: userId, count: 10 });

      for (const post of wall.items) {
          const likes = await vk.api.likes.getList({
              type: 'post',
              owner_id: userId,
              item_id: post.id,
              extended: 1 // Получаем имена
          });

          for (const user of likes.items) {
              const userKey = `👤 ${user.first_name} ${user.last_name}`;
              likesData.set(userKey, (likesData.get(userKey) || 0) + 1);
          }
      }

      // Получаем фото профиля
      const profilePhotos = await vk.api.photos.get({
          owner_id: userId,
          album_id: 'profile',
          count: 5
      });

      for (const photo of profilePhotos.items) {
          const likes = await vk.api.likes.getList({
              type: 'photo',
              owner_id: userId,
              item_id: photo.id,
              extended: 1
          });

          for (const user of likes.items) {
              const userKey = `📸 ${user.first_name} ${user.last_name}`;
              likesData.set(userKey, (likesData.get(userKey) || 0) + 1);
          }
      }

      // Получаем все фото из профиля
      const allPhotos = await vk.api.photos.getAll({
          owner_id: userId,
          count: 10
      });

      for (const photo of allPhotos.items) {
          const likes = await vk.api.likes.getList({
              type: 'photo',
              owner_id: userId,
              item_id: photo.id,
              extended: 1
          });

          for (const user of likes.items) {
              const userKey = `🖼️ ${user.first_name} ${user.last_name}`;
              likesData.set(userKey, (likesData.get(userKey) || 0) + 1);
          }
      }

      if (likesData.size === 0) {
          return ['❌ Лайков не найдено'];
      }

      return Array.from(likesData.entries()).map(([name, count]) => `❤️ ${name}: ${count} лайков`).join('\n');
  } catch (error) {
      console.error(error);
      return '⚠ Ошибка при получении лайков';
  }
}

// Обработка команды /like
bot.onText(/\/like (\d+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = match[1];

  bot.sendMessage(chatId, '⏳ Получаю информацию...');

  const userName = await getUserName(userId);
  const likesText = await getLikes(userId);

  const header = `📊 *Статистика по лайкам для ${userName}*`;
  const messages = splitMessage(`${header}\n\n${likesText}`);

  for (const message of messages) {
      bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  }
});

//📌 команда post
bot.onText(/\/post (\d+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = match[1];

  try {
      const response = await vk.api.wall.get({ owner_id: userId, count: 5 });
      if (!response.items.length) {
          return bot.sendMessage(chatId, "❌ Посты не найдены.");
      }

      for (const post of response.items) {
          let text = post.text || "(Без текста)";
          let attachments = [];
          let isRepost = false;
          let repostText = "";
          
          if (post.copy_history) {
              isRepost = true;
              const repost = post.copy_history[0];
              repostText = `\n🔁 Репост от [vk.com/id${repost.owner_id}](https://vk.com/id${repost.owner_id})\n`;
              text += repostText + (repost.text || "(Без текста)");
              
              if (repost.attachments) {
                  for (const att of repost.attachments) {
                      if (att.type === "photo") {
                          const photo = att.photo.sizes.pop().url;
                          attachments.push(photo);
                      }
                  }
              }
          }
          
          if (post.attachments) {
              for (const att of post.attachments) {
                  if (att.type === "photo") {
                      const photo = att.photo.sizes.pop().url;
                      attachments.push(photo);
                  }
              }
          }

          let caption = `📝 ${isRepost ? "Репост" : "Пост"} от [vk.com/id${userId}](https://vk.com/id${userId})\n${text}`;
          if (attachments.length) {
              await bot.sendPhoto(chatId, attachments[0], { caption, parse_mode: "Markdown" });
          } else {
              await bot.sendMessage(chatId, caption, { parse_mode: "Markdown" });
          }
      }
  } catch (error) {
      console.error(error);
      bot.sendMessage(chatId, "⚠️ Ошибка при получении постов.");
  }
});

//📌 команда общение
bot.onText(/\/общение (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = match[1].trim();

    if (!userId || isNaN(userId)) {
        return bot.sendMessage(chatId, '⚠️ Неверный ID пользователя. Укажите числовой ID.');
    }

    try {
        const [targetUser] = await vk.api.users.get({ 
            user_ids: userId, 
            fields: ['last_seen'] 
        });

        if (!targetUser?.last_seen) {
            return bot.sendMessage(chatId, '❌ Не удалось получить данные пользователя или он скрыл время последнего посещения.');
        }

        const targetLastSeen = targetUser.last_seen.time;
        const targetExitTime = new Date(targetLastSeen * 1000);

        // Получаем друзей пользователя
        const { items: friends } = await vk.api.friends.get({ 
            user_id: userId, 
            fields: ['last_seen', 'first_name', 'last_name'] 
        });

        if (!friends || friends.length === 0) {
            return bot.sendMessage(chatId, 'У пользователя нет друзей или они скрыты.');
        }

        // Фильтруем друзей, которые были онлайн ±5 минут от времени выхода
        const possibleFriends = friends.filter(friend => {
            if (!friend.last_seen) return false;

            const friendLastSeen = friend.last_seen.time;
            const diffMinutes = Math.abs((targetLastSeen - friendLastSeen) / 60);

            return diffMinutes <= 5;
        });

        if (possibleFriends.length === 0) {
            return bot.sendMessage(chatId, 'Нет друзей, которые были онлайн в пределах 5 минут от времени выхода пользователя.');
        }

        // Формируем сообщение
        let message = `👥 Возможные друзья, с которыми общался пользователь [id${userId}|${targetUser.first_name} ${targetUser.last_name}]:\n\n`;
        message += `🕒 Время выхода: ${targetExitTime.toLocaleString('ru-RU')}\n\n`;

        possibleFriends.forEach(friend => {
            const friendLastSeen = friend.last_seen.time;
            const diffMinutes = Math.abs((targetLastSeen - friendLastSeen) / 60);
            let emoji;

            if (diffMinutes >= 0 && diffMinutes <= 1) emoji = '🟢'; // 0-1 мин
            else if (diffMinutes <= 3) emoji = '🟡'; // 2-3 мин
            else emoji = '🔴'; // 4-5 мин

            const friendExitTime = new Date(friendLastSeen * 1000);
            message += `${emoji} [id${friend.id}|${friend.first_name} ${friend.last_name}] — ${friendExitTime.toLocaleString('ru-RU')}\n`;
        });

        bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    } catch (error) {
        console.error(error);
        bot.sendMessage(chatId, '⚠️ Произошла ошибка при обработке запроса.');
    }
});

//📌 команда update
bot.onText(/\/update/, async (msg) => {
  const chatId = msg.chat.id;
  
  try {
    // Параметры обновления
    const version = "2.1";
    const updateTitle = "VK Шпион v" + version;
    const updateFeatures = [
      "• Команда /общение"
    ];

    // Создаем холст с увеличенными размерами
    const canvasWidth = 800;
    const canvasHeight = 600;
    const canvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext("2d");

    // Градиентный фон
    const gradient = ctx.createLinearGradient(0, 0, canvasWidth, canvasHeight);
    gradient.addColorStop(0, "#1e3c72");
    gradient.addColorStop(1, "#2a5298");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Заголовок с тенью
    ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 5;
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 42px Arial";
    ctx.textAlign = "center";
    ctx.fillText(updateTitle, canvasWidth / 2, 100);
    ctx.shadowColor = "transparent"; // Сбрасываем тень

    // Блок с информацией
    const blockWidth = 700;
    const blockHeight = 350;
    const blockX = (canvasWidth - blockWidth) / 2;
    const blockY = 150;
    
    // Скругленный прямоугольник для блока
    ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 2;
    roundedRect(ctx, blockX, blockY, blockWidth, blockHeight, 20);
    ctx.fill();
    ctx.stroke();

    // Иконка обновления
    ctx.font = "72px Arial";
    ctx.fillStyle = "#4fc3f7";
    ctx.fillText("🆕", canvasWidth / 2 - 300, 180);

    // Текст обновления
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 28px Arial";
    ctx.fillText("Что нового в этой версии:", canvasWidth / 2, 200);

    // Список изменений
    ctx.font = "24px Arial";
    let yPos = 250;
    const lineHeight = 40;
    
    updateFeatures.forEach(feature => {
      ctx.fillText(feature, canvasWidth / 2, yPos);
      yPos += lineHeight;
    });

    // Подпись разработчика
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.font = "italic 20px Arial";
    ctx.fillText("Developer by INK", canvasWidth / 2, canvasHeight - 50);

    // Версия в углу
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.font = "16px Arial";
    ctx.textAlign = "right";
    ctx.fillText("v" + version, canvasWidth - 30, canvasHeight - 30);

    // Сохранение временного файла
    const tempFile = path.join(os.tmpdir(), `update_${version}.png`);
    const out = fs.createWriteStream(tempFile);
    const stream = canvas.createPNGStream();

    await new Promise((resolve, reject) => {
      stream.pipe(out);
      out.on('finish', resolve);
      out.on('error', reject);
    });

    // Отправка изображения
    await bot.sendPhoto(chatId, tempFile, {
      caption: `🆕 Обновление ${updateTitle}\n` 
    });

    // Удаление временного файла
    fs.unlink(tempFile, () => {});

  } catch (error) {
    console.error("Ошибка при создании изображения обновления:", error);
    await bot.sendMessage(chatId, "❌ Произошла ошибка при создании информации об обновлении");
  }
});

// Вспомогательная функция для скругленных прямоугольников
function roundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

// Запуск периодической проверки изменений каждую 1 минуту
setInterval(periodicTracking, 60 * 1000); // 60 секунд