const {
    Telegraf
} = require('telegraf');
const {
    MongoClient
} = require('mongodb');
require('dotenv').config();


const bot = new Telegraf(process.env.BOT_TOKEN || `7176585147:AAETQUAgBIlsxLQprquJkQUUNV0K47nVV3o`);
const client = new MongoClient(process.env.MONGOURI || `mongodb+srv://moviessearchbot:moviessearchbot@cluster0.gxqztlk.mongodb.net/?retryWrites=true&w=majority`);
const dbName = 'Pbot';

const admins = ['5397992078', '5606990991']
let channelId = '-1001902665212'; // fsub Channel Id
let logId = '-1002168567134'; // Log group Id
let dbId = '-1002008957712'; // db group Id
let botUsername;
let botId;

bot.telegram.getMe().then((botInfo) => {
    botUsername = botInfo.username;
    botId = botInfo.id;
});
bot.telegram.sendMessage(logId, `Bot Restarted! 🌟`);

client.connect().then(() => {
    console.log('Connected to MongoDB')
}).catch(err => {
    bot.telegram.sendMessage(logId, `Error connecting to MongoDBr :\n${err}`);
});
// Error handling middleware
bot.catch((err, ctx) => {
    console.error(`Encountered an error for ${ctx.updateType}`, err);
    if (err.code === 429 && err.description.includes('FLOOD_WAIT')) {
        const secondsToWait = parseInt(err.parameters.retry_after) || 10; // Default to waiting for 10 seconds
        console.log(`Waiting for ${secondsToWait} seconds before retrying...`);
        setTimeout(() => ctx.updateHandlerChain(), secondsToWait * 1000);
    } else {
        ctx.reply(`Sorry, something went wrong.\nError => ${err}`);
        bot.telegram.sendMessage(logId, `Error :\n${err}`);
    }
});

bot.command('users', async (ctx) => {
    try {
        if (admins.includes(String(ctx.message.from.id)) && ctx.message.chat.type === 'private') {
            const users = await client.db(dbName).collection('Users').find().toArray();
            const totalUsers = users.length;
            // Count duplicate registrations
            const duplicateUserIds = {};
            users.forEach(async (user) => {
                duplicateUserIds[user.userId] = (duplicateUserIds[user.userId] || 0) + 1;
                if (duplicateUserIds[user.userId] > 1) {
                    // Delete the duplicate user
                    await client.db(dbName).collection('Users').deleteOne({
                        userId: user.userId
                    });
                }
            });
            const duplicateRegistrationsCount = Object.values(duplicateUserIds).filter(count => count > 1).length;

            await ctx.reply(`Total User : ${totalUsers}\nDuplicate Registrations: ${duplicateRegistrationsCount}`);
        }
    } catch (error) {
        bot.telegram.sendMessage(logId, `Error sending total users and blocked users count:\n${error}`);
    }
});

bot.command('shortlink', async (ctx) => {
    try {
        if (admins.includes(String(ctx.message.from.id)) && ctx.message.chat.type === 'private') {
            const existingEntry = await client.db(dbName).collection('BotSetting').findOne({
                botName: botUsername
            });
            const currentStatus = existingEntry.shortLink ? 'ON' : 'OFF';

            let buttons;
            if (currentStatus === 'ON') {
                buttons = [{
                    text: '🔥 OFF',
                    callback_data: 'shortlink_off'
                }];
            } else {
                buttons = [{
                    text: '⚡ ON',
                    callback_data: 'shortlink_on'
                }];
            }

            await ctx.reply(`Current Status: ${currentStatus}`, {
                reply_markup: {
                    inline_keyboard: [buttons]
                }
            });
        }
    } catch (error) {
        await bot.telegram.sendMessage(logId, `Short Link on/Off Error:\n${error}`);
    }
});

bot.command('fsub', async (ctx) => {
    try {
        if (admins.includes(String(ctx.message.from.id)) && ctx.message.chat.type === 'private') {
            const existingEntry = await client.db(dbName).collection('BotSetting').findOne({
                botName: botUsername
            });
            const currentStatus = existingEntry.fsub ? 'ON' : 'OFF';

            let buttons;
            if (currentStatus === 'ON') {
                buttons = [{
                    text: '🔥 OFF',
                    callback_data: 'fsub_off'
                }];
            } else {
                buttons = [{
                    text: '⚡ ON',
                    callback_data: 'fsub_on'
                }];
            }

            await ctx.reply(`Current Status: ${currentStatus}`, {
                reply_markup: {
                    inline_keyboard: [buttons]
                }
            });
        }
    } catch (error) {
        await bot.telegram.sendMessage(logId, `Force Sub on/Off Error:\n${error}`);
    }
});

bot.command('broadcast', async (ctx) => {
    try {
        if (admins.includes(String(ctx.message.from.id)) && ctx.message.chat.type === 'private') {
            // Check if the command was a reply to a message
            if (ctx.message.reply_to_message) {
                // Get the message to broadcast
                const messageToBroadcast = ctx.message.reply_to_message;
                if (messageToBroadcast) {
                    const users = await client.db(dbName).collection('Users').find().toArray();
                    const totalUsers = users.length;
                    let messagesSent = 0;
                    let blockedBy = 0;
                    const broadcastMessage = await ctx.reply(`Total User: ${totalUsers}\nBroadcasting Message Started`);

                    // Loop through users in batches of 10
                    for (let i = 0; i < totalUsers; i += 10) {
                        const usersBatch = users.slice(i, i + 10);
                        for (const user of usersBatch) {
                            if (user.broadcast == true) {
                                // if true then no need to send message again
                            } else {
                                try {
                                    await ctx.telegram.forwardMessage(user.userId, messageToBroadcast.chat.id, messageToBroadcast.message_id);
                                    await client.db(dbName).collection('Users').updateOne({
                                        userId: user.userId
                                    }, {
                                        $set: {
                                            broadcast: true
                                        }
                                    });
                                    messagesSent++;
                                    await ctx.telegram.editMessageText(
                                        broadcastMessage.chat.id,
                                        broadcastMessage.message_id,
                                        null,
                                        `Total User: ${totalUsers}\nBroadcasting Message in Progress\nMessages Sent: ${messagesSent}/${totalUsers}`
                                    );
                                } catch (error) {
                                    if (error.code === 429 && error.description.includes('FLOOD_WAIT')) {
                                        const secondsToWait = parseInt(error.parameters.retry_after) || 10;
                                        console.log(`Waiting for ${secondsToWait} seconds before retrying...`);
                                        await new Promise(resolve => setTimeout(resolve, secondsToWait * 1000));
                                    } else if (error.code === 403 && error.description.includes('bot was blocked')) {
                                        console.log(`Forbidden: bot was blocked by the user ${user.userId}`);
                                        await client.db(dbName).collection('Users').deleteOne({
                                            userId: user.userId
                                        })
                                        blockedBy++;
                                    } else {
                                        console.log(`Error broadcasting message to user ${user.userId}:`, error);
                                    }
                                }
                            }
                        }
                        // Wait for 5 seconds before processing the next batch
                        await new Promise(resolve => setTimeout(resolve, 5000));
                    }

                    try {
                        await ctx.telegram.editMessageText(
                            broadcastMessage.chat.id,
                            broadcastMessage.message_id,
                            null,
                            `📢 Message broadcasted successfully!\n👥 Total Users: ${totalUsers}\n✉️ Messages Sent successfully: ${messagesSent}\n\n🚫 Bot Blocked By ${blockedBy} users\n🗑️ And ${blockedBy} users who blocked me have been deleted.`
                        );
                        await client.db(dbName).collection('Users').updateMany({
                            broadcast: true
                        }, {
                            $set: {
                                broadcast: false
                            }
                        });

                    } catch (error) {
                        console.error('Error editing broadcast message:', error);
                    }
                } else {
                    ctx.reply('No message to broadcast.');
                }
            } else {
                ctx.reply('Reply to a message with /broadcast to broadcast it.');
            }
        }
    } catch (error) {
        bot.telegram.sendMessage(logId, `Error broadcasting message:`, error);
    }
});



bot.start(async (ctx) => {
    try {
        userRegister(ctx)
        if (ctx.message.chat.type === 'private') {
            const commandParts = ctx.message.text.split(' ');
            if (commandParts.length > 1 && commandParts[1].startsWith('file_')) {
                try {
                    const fileUniqueId = commandParts[1].slice(5);
                    const existingEntry = await client.db(dbName).collection('Files').findOne({
                        fileUniqueId: fileUniqueId
                    });
                    if (existingEntry && existingEntry.fileId) {
                        await ctx.replyWithHTML(`<b>📁File Details</b>\n\n<b>File Name:</b> ${existingEntry.fileName}\n\n<b>File Size:</b> ${existingEntry.fileSize}\n\n<b>MimeType:</b> ${existingEntry.mimeType}`, {
                            reply_markup: {
                                inline_keyboard: [
                                    [{
                                        text: 'Download File',
                                        callback_data: `file_${existingEntry.fileUniqueId}`
                                    }]
                                ]
                            }
                        });
                    } else {
                        ctx.reply('File Not Found');
                    }
                } catch (error) {

                }
            } else if (commandParts.length > 1 && commandParts[1].startsWith('token_')) {
                try {
                    const existingEntry = await client.db(dbName).collection('Users').findOne({
                        userId: ctx.message.from.id
                    });
                    const parameter = commandParts[1].slice(6);
                    if (existingEntry.isVerified === true) {
                        ctx.react('⚡')
                        ctx.reply('You are already verified.')
                    } else {
                        const decryptedCode = mixedCaesarCipher(parameter, -2);
                        if (existingEntry.code == decryptedCode) {
                            const currentDate = new Date();
                            await client.db(dbName).collection('Users').updateOne({
                                userId: ctx.message.from.id
                            }, {
                                $set: {
                                    code: 0,
                                    isVerified: true,
                                    vDate: currentDate,
                                }
                            });
                            ctx.reply('Verification Successful!');
                        } else {
                            ctx.reply('Verification Failed. Retry!');
                        }
                    }
                } catch (error) {

                }
            } else {
                try {
                    await ctx.replyWithHTML(await wellcomeMessage(ctx))
                } catch (error) {}
            }
        }
    } catch (error) {
        bot.telegram.sendMessage(logId, `Start Command Error :\n${error}`);
    }
})

bot.command('admintoken', async (ctx) => {
    try {
        if (admins.includes(String(ctx.message.from.id)) && ctx.message.chat.type === 'private') {
            const existingEntry = await client.db(dbName).collection('Users').findOne({
                userId: ctx.message.from.id
            });
            if (existingEntry.isVerified === true) {
                ctx.react('⚡')
                ctx.reply('You are already verified.')
            } else {
                const currentDate = new Date();
                await client.db(dbName).collection('Users').updateOne({
                    userId: ctx.message.from.id
                }, {
                    $set: {
                        code: 0,
                        isVerified: true,
                        vDate: currentDate,
                    }
                });
                ctx.react('🔥')
                ctx.reply('Verification Successful!');
            }
        }
    } catch (error) {
        bot.telegram.sendMessage(logId, `Error in Admin Token Verify:\n${error}`);
    }
});

bot.on('callback_query', async (ctx) => {
    const data = ctx.callbackQuery.data;
    try {
        if (data.startsWith('file_')) {
            if (await isUserMember(channelId, ctx)) {
                if (await isVerified(ctx)) {
                    try {
                        await ctx.answerCbQuery('Sending File...');
                        const fileUniqueId = data.slice(5);
                        ctx.sendChatAction('upload_document')
                        const existingEntry = await client.db(dbName).collection('Files').findOne({
                            fileUniqueId: fileUniqueId
                        });
                        try {
                            if (existingEntry.fileId) {
                                const file = ctx.sendDocument(existingEntry.fileId, {
                                    caption: `This file will be deleted after 10 minutes. Please forward it to another chat before downloading.`
                                })
                                await ctx.telegram.deleteMessage(ctx.chat.id, ctx.callbackQuery.message.message_id);

                                const deleteAfter = 10 * 60 * 1000;
                                setTimeout(async () => {
                                    try {
                                        await ctx.deleteMessage((await file).message_id);
                                        ctx.reply(`File successfully deleted after 10 minutes due to copyright issues.`);
                                    } catch (error) {
                                        console.error(`Error deleting message ${messageId}:`, error);
                                    }
                                }, deleteAfter);
                            } else {
                                ctx.reply('File Not Found')
                                await ctx.telegram.deleteMessage(ctx.chat.id, ctx.callbackQuery.message.message_id);
                            }
                        } catch (error) {
                            bot.telegram.sendMessage(logId, `Send File Error :`, error);
                        }
                    } catch (error) {

                    }
                } else {
                    try {
                        await ctx.answerCbQuery('Checking Your Token');
                        ctx.reply('First Verify Your Token', {
                            reply_markup: {
                                inline_keyboard: [
                                    [{
                                        text: 'Verify',
                                        callback_data: 'tokenverify',
                                    }]
                                ]
                            }
                        });
                    } catch (error) {

                    }
                }
            } else {
                try {
                    await ctx.answerCbQuery('Checking Channel joined Or Not');
                    ctx.reply('First Join Our Channel', {
                        reply_markup: {
                            inline_keyboard: [
                                [{
                                    text: 'Join Now',
                                    url: 'https://t.me/Pbail_Movie_Channel',
                                }]
                            ]
                        }
                    });
                    F
                } catch (error) {

                }
            }
        } else if (data.startsWith('tokenverify')) {
            try {
                await ctx.answerCbQuery('Wait, generating Token...');
                const code = await generateVerificationCode()
                const encryptedCode = await mixedCaesarCipher(code, 2);
                const existingEntry = await client.db(dbName).collection('Users').findOne({
                    userId: ctx.callbackQuery.from.id
                });
                if (existingEntry) {
                    await client.db(dbName).collection('Users').updateOne({
                        userId: ctx.callbackQuery.from.id
                    }, {
                        $set: {
                            code: code
                        }
                    });
                }
                const verificationLink = await generateLink(`https://t.me/${botUsername}?start=token_${encryptedCode}`, ctx);
                await ctx.reply(`Click the button to verify Token:`, {
                    reply_markup: {
                        inline_keyboard: [
                            [{
                                text: 'Verify Token',
                                url: verificationLink
                            }],
                            [{
                                text: 'How To Verify Token',
                                url: 'https://t.me/Pbail_Movie_Channel/10'
                            }]
                        ]
                    }
                })
                ctx.telegram.deleteMessage(ctx.chat.id, ctx.callbackQuery.message.message_id);
            } catch (error) {
                bot.telegram.sendMessage(logId, `Token Verify Error:`, error);
            }
        } else if (data === 'shortlink_on') {
            try {
                const botSettingCollection = client.db(dbName).collection('BotSetting');
                await botSettingCollection.updateOne({
                    botName: botUsername
                }, {
                    $set: {
                        shortLink: true
                    }
                });

                await ctx.editMessageText('Current Status: ON', {
                    reply_markup: {
                        inline_keyboard: [
                            [{
                                text: '🔥 OFF',
                                callback_data: 'shortlink_off'
                            }]
                        ]
                    }
                });
            } catch (error) {
                await bot.telegram.sendMessage(logId, `Error turning short link ON:\n${error}`);
            }
        } else if (data === 'shortlink_off') {
            try {
                const botSettingCollection = client.db(dbName).collection('BotSetting');
                await botSettingCollection.updateOne({
                    botName: botUsername
                }, {
                    $set: {
                        shortLink: false
                    }
                });

                await ctx.editMessageText('Current Status: OFF', {
                    reply_markup: {
                        inline_keyboard: [
                            [{
                                text: '⚡ ON',
                                callback_data: 'shortlink_on'
                            }]
                        ]
                    }
                });
            } catch (error) {
                await bot.telegram.sendMessage(logId, `Error turning short link OFF:\n${error}`);
            }
        } else if (data === 'fsub_on') {
            try {
                const botSettingCollection = client.db(dbName).collection('BotSetting');
                await botSettingCollection.updateOne({
                    botName: botUsername
                }, {
                    $set: {
                        fsub: true
                    }
                });

                await ctx.editMessageText('Current Status: ON', {
                    reply_markup: {
                        inline_keyboard: [
                            [{
                                text: '🔥 OFF',
                                callback_data: 'fsub_off'
                            }]
                        ]
                    }
                });
            } catch (error) {
                await bot.telegram.sendMessage(logId, `Error turning fsub ON:\n${error}`);
            }
        } else if (data === 'fsub_off') {
            try {
                const botSettingCollection = client.db(dbName).collection('BotSetting');
                await botSettingCollection.updateOne({
                    botName: botUsername
                }, {
                    $set: {
                        fsub: false
                    }
                });

                await ctx.editMessageText('Current Status: OFF', {
                    reply_markup: {
                        inline_keyboard: [
                            [{
                                text: '⚡ ON',
                                callback_data: 'fsub_on'
                            }]
                        ]
                    }
                });
            } catch (error) {
                await bot.telegram.sendMessage(logId, `Error turning fsub OFF:\n${error}`);
            }
        }
    } catch (error) {
        bot.telegram.sendMessage(logId, `CallbackQuery Error :\n${error}`);
    }
});

bot.on('message', async (ctx) => {
    try {
        userRegister(ctx)
        if (ctx.message.chat.type === 'private') {
            try {
                if (ctx.message.document) {
                    const ReadableFileSize = await humanReadableFileSize(ctx.message.document.file_size)
                    const fileName = ctx.message.document.file_name || "unknown";
                    const fileId = ctx.message.document.file_id
                    const fileUniqueId = ctx.message.document.file_unique_id
                    const fileSize = ReadableFileSize
                    const mimeType = ctx.message.document.mime_type
                    const thumbnail = ctx.message.document.thumbnail ? ctx.message.document.thumbnail.file_id : null;

                    const existingEntry = await client.db(dbName).collection('Files').findOne({
                        fileUniqueId: fileUniqueId
                    });
                    if (existingEntry) {
                        try {
                            const link = `https://t.me/${botUsername}?start=file_${existingEntry.fileUniqueId}`;
                            await ctx.replyWithHTML(`<b>📁File Details</b>\n\n<b>File Name:</b> ${existingEntry.fileName}\n\n<b>File Size:</b> ${existingEntry.fileSize}\n\n<b>MimeType:</b> ${existingEntry.mimeType}`, {
                                reply_markup: {
                                    inline_keyboard: [
                                        [{
                                            text: 'Get File Details',
                                            url: link,
                                        }]
                                    ]
                                },
                                reply_to_message_id: ctx.message.message_id
                            });
                        } catch (error) {

                        }
                    } else {
                        try {
                            await ctx.forwardMessage(dbId, ctx.message)
                            await client.db(dbName).collection('Files').insertOne({
                                fileName: fileName,
                                fileId: fileId,
                                fileUniqueId: fileUniqueId,
                                fileSize: fileSize,
                                mimeType: mimeType,
                                thumbnail: thumbnail
                            });
                            const link = `https://t.me/${botUsername}?start=file_${fileUniqueId}`
                            await ctx.replyWithHTML(`<b>📁File Details</b>\n\n<b>File Name:</b> ${fileName}\n\n<b>File Size:</b> ${fileSize}\n\n<b>MimeType:</b> ${mimeType}`, {
                                reply_markup: {
                                    inline_keyboard: [
                                        [{
                                            text: 'Get File Details',
                                            url: link,
                                        }]
                                    ]
                                },
                                reply_to_message_id: ctx.message.message_id
                            });
                        } catch (error) {

                        }
                    }
                } else if (ctx.message.video) {
                    try {
                        const ReadableFileSize = await humanReadableFileSize(ctx.message.video.file_size)
                        const fileName = ctx.message.video.file_name
                        const fileId = ctx.message.video.file_id
                        const fileUniqueId = ctx.message.video.file_unique_id
                        const fileSize = ReadableFileSize
                        const mimeType = ctx.message.video.mime_type
                        const thumbnail = ctx.message.video.thumbnail ? ctx.message.video.thumbnail.file_id : null;

                        const existingEntry = await client.db(dbName).collection('Files').findOne({
                            fileUniqueId: fileUniqueId
                        });
                        if (existingEntry) {
                            const link = `https://t.me/${botUsername}?start=file_${existingEntry.fileUniqueId}`;
                            await ctx.replyWithHTML(`<b>📁File Details</b>\n\n<b>File Name:</b> ${existingEntry.fileName}\n\n<b>File Size:</b> ${existingEntry.fileSize}\n\n<b>MimeType:</b> ${existingEntry.mimeType}`, {
                                reply_markup: {
                                    inline_keyboard: [
                                        [{
                                            text: 'Get File Details',
                                            url: link,
                                        }]
                                    ]
                                },
                                reply_to_message_id: ctx.message.message_id
                            });
                        } else {
                            await ctx.forwardMessage(dbId, ctx.message)
                            await client.db(dbName).collection('Files').insertOne({
                                fileName: fileName,
                                fileId: fileId,
                                fileUniqueId: fileUniqueId,
                                fileSize: fileSize,
                                mimeType: mimeType,
                                thumbnail: thumbnail
                            });
                            const link = `https://t.me/${botUsername}?start=file_${fileUniqueId}`
                            await ctx.replyWithHTML(`<b>📁File Details</b>\n\n<b>File Name:</b> ${fileName}\n\n<b>File Size:</b> ${fileSize}\n\n<b>MimeType:</b> ${mimeType}`, {
                                reply_markup: {
                                    inline_keyboard: [
                                        [{
                                            text: 'Get File Details',
                                            url: link,
                                        }]
                                    ]
                                },
                                reply_to_message_id: ctx.message.message_id
                            });
                        }
                    } catch (error) {

                    }
                } else if (ctx.message.audio) {
                    try {
                        const ReadableFileSize = await humanReadableFileSize(ctx.message.audio.file_size)
                        const fileName = ctx.message.audio.file_name
                        const fileId = ctx.message.audio.file_id
                        const fileUniqueId = ctx.message.audio.file_unique_id
                        const fileSize = ReadableFileSize
                        const mimeType = ctx.message.audio.mime_type
                        const thumbnail = ctx.message.audio.thumbnail ? ctx.message.audio.thumbnail.file_id : null;

                        const existingEntry = await client.db(dbName).collection('Files').findOne({
                            fileUniqueId: fileUniqueId
                        });
                        if (existingEntry) {
                            const link = `https://t.me/${botUsername}?start=file_${existingEntry.fileUniqueId}`;
                            await ctx.replyWithHTML(`<b>📁File Details</b>\n\n<b>File Name:</b> ${existingEntry.fileName}\n\n<b>File Size:</b> ${existingEntry.fileSize}\n\n<b>MimeType:</b> ${existingEntry.mimeType}`, {
                                reply_markup: {
                                    inline_keyboard: [
                                        [{
                                            text: 'Get File Details',
                                            url: link,
                                        }]
                                    ]
                                },
                                reply_to_message_id: ctx.message.message_id
                            });
                        } else {
                            await ctx.forwardMessage(dbId, ctx.message)
                            await client.db(dbName).collection('Files').insertOne({
                                fileName: fileName,
                                fileId: fileId,
                                fileUniqueId: fileUniqueId,
                                fileSize: fileSize,
                                mimeType: mimeType,
                                thumbnail: thumbnail
                            });
                            const link = `https://t.me/${botUsername}?start=file_${fileUniqueId}`
                            await ctx.replyWithHTML(`<b>📁File Details</b>\n\n<b>File Name:</b> ${fileName}\n\n<b>File Size:</b> ${fileSize}\n\n<b>MimeType:</b> ${mimeType}`, {
                                reply_markup: {
                                    inline_keyboard: [
                                        [{
                                            text: 'Get File Details',
                                            url: link,
                                        }]
                                    ]
                                },
                                reply_to_message_id: ctx.message.message_id
                            });
                        }
                    } catch (error) {

                    }
                } else if (ctx.message.voice) {
                    try {
                        const ReadableFileSize = await humanReadableFileSize(ctx.message.voice.file_size)
                        const fileName = ctx.message.voice.file_name
                        const fileId = ctx.message.voice.file_id
                        const fileUniqueId = ctx.message.voice.file_unique_id
                        const fileSize = ReadableFileSize
                        const mimeType = ctx.message.voice.mime_type
                        const thumbnail = ctx.message.voice.thumbnail ? ctx.message.voice.thumbnail.file_id : null;

                        const existingEntry = await client.db(dbName).collection('Files').findOne({
                            fileUniqueId: fileUniqueId
                        });
                        if (existingEntry) {
                            const link = `https://t.me/${botUsername}?start=file_${existingEntry.fileUniqueId}`;
                            await ctx.replyWithHTML(`<b>📁File Details</b>\n\n<b>File Name:</b> ${existingEntry.fileName}\n\n<b>File Size:</b> ${existingEntry.fileSize}\n\n<b>MimeType:</b> ${existingEntry.mimeType}`, {
                                reply_markup: {
                                    inline_keyboard: [
                                        [{
                                            text: 'Get File Details',
                                            url: link,
                                        }]
                                    ]
                                },
                                reply_to_message_id: ctx.message.message_id
                            });
                        } else {
                            await ctx.forwardMessage(dbId, ctx.message)
                            await client.db(dbName).collection('Files').insertOne({
                                fileName: fileName,
                                fileId: fileId,
                                fileUniqueId: fileUniqueId,
                                fileSize: fileSize,
                                mimeType: mimeType,
                                thumbnail: thumbnail
                            });
                            const link = `https://t.me/${botUsername}?start=file_${fileUniqueId}`
                            await ctx.replyWithHTML(`<b>📁File Details</b>\n\n<b>File Name:</b> ${fileName}\n\n<b>File Size:</b> ${fileSize}\n\n<b>MimeType:</b> ${mimeType}`, {
                                reply_markup: {
                                    inline_keyboard: [
                                        [{
                                            text: 'Get File Details',
                                            url: link,
                                        }]
                                    ]
                                },
                                reply_to_message_id: ctx.message.message_id
                            });
                        }
                    } catch (error) {

                    }
                } else if (ctx.message.video_note) {
                    try {
                        const ReadableFileSize = await humanReadableFileSize(ctx.message.video_note.file_size)
                        const fileName = ctx.message.video_note.file_name
                        const fileId = ctx.message.video_note.file_id
                        const fileUniqueId = ctx.message.video_note.file_unique_id
                        const fileSize = ReadableFileSize
                        const mimeType = ctx.message.video_note.mime_type
                        const thumbnail = ctx.message.video_note.thumbnail ? ctx.message.video_note.thumbnail.file_id : null;

                        const existingEntry = await client.db(dbName).collection('Files').findOne({
                            fileUniqueId: fileUniqueId
                        });
                        if (existingEntry) {
                            const link = `https://t.me/${botUsername}?start=file_${existingEntry.fileUniqueId}`;
                            await ctx.replyWithHTML(`<b>📁File Details</b>\n\n<b>File Name:</b> ${existingEntry.fileName}\n\n<b>File Size:</b> ${existingEntry.fileSize}\n\n<b>MimeType:</b> ${existingEntry.mimeType}`, {
                                reply_markup: {
                                    inline_keyboard: [
                                        [{
                                            text: 'Get File Details',
                                            url: link,
                                        }]
                                    ]
                                },
                                reply_to_message_id: ctx.message.message_id
                            });
                        } else {
                            await ctx.forwardMessage(dbId, ctx.message)
                            await client.db(dbName).collection('Files').insertOne({
                                fileName: fileName,
                                fileId: fileId,
                                fileUniqueId: fileUniqueId,
                                fileSize: fileSize,
                                mimeType: mimeType,
                                thumbnail: thumbnail
                            });
                            const link = `https://t.me/${botUsername}?start=file_${fileUniqueId}`
                            await ctx.replyWithHTML(`<b>📁File Details</b>\n\n<b>File Name:</b> ${fileName}\n\n<b>File Size:</b> ${fileSize}\n\n<b>MimeType:</b> ${mimeType}`, {
                                reply_markup: {
                                    inline_keyboard: [
                                        [{
                                            text: 'Get File Details',
                                            url: link,
                                        }]
                                    ]
                                },
                                reply_to_message_id: ctx.message.message_id
                            });
                        }
                    } catch (error) {

                    }
                }
            } catch (error) {
                bot.telegram.sendMessage(logId, `On Message file send Error :\n${error}`);
            }
        }
    } catch (error) {
        bot.telegram.sendMessage(logId, `On Message Error :\n${error}`);
    }
})



async function userRegister(ctx) {
    const existingEntry = await client.db(dbName).collection('Users').findOne({
        userId: ctx.message.from.id
    });
    const currentDate = new Date();

    function formatDate(date) {
        const d = date.getDate().toString().padStart(2, '0');
        const m = (date.getMonth() + 1).toString().padStart(2, '0');
        const y = date.getFullYear().toString().slice(-2);
        return `${d}-${m}-${y}`;
    }
    if (!existingEntry) {
        try {
            bot.telegram.sendMessage(logId, `New User: ${ctx.message.from.first_name}`);
        } catch (error) {

        }
        const formattedDate = formatDate(currentDate);
        await client.db(dbName).collection('Users').insertOne({
            userId: ctx.message.from.id,
            joinDate: formattedDate,
            code: 0,
            isVerified: false,
            vDate: 0,
            shortner: false,

        });
    }
}

async function isVerified(ctx) {
    const existingEntry = await client.db(dbName).collection('BotSetting').findOne({
        botName: botUsername
    });
    const currentStatus = existingEntry.shortLink ? 'ON' : 'OFF';

    if (currentStatus === 'OFF') {
        return true
    } else {
        const existingEntry = await client.db(dbName).collection('Users').findOne({
            userId: ctx.callbackQuery.from.id
        });
        if (existingEntry.isVerified == true) {
            return true
        } else {
            return false
        }
    }
}

async function isUserMember(channelId, ctx) {
    const existingEntry = await client.db(dbName).collection('BotSetting').findOne({
        botName: botUsername
    });
    const currentStatus = existingEntry.fsub ? 'ON' : 'OFF';
    if (currentStatus === 'OFF') {
        return true
    } else {
        try {
            const result = await ctx.telegram.getChatMember(channelId, ctx.callbackQuery.from.id);
            return result && ['member', 'administrator', 'creator'].includes(result.status);

        } catch (error) {
            console.error('Error checking channel membership:', error);
            // Handle the error or re-throw it if necessary
            throw error;
        }
    }

}

function mixedCaesarCipher(code, shift, mode = 'encrypt') {
    if (code.length !== 6) {
        throw new Error('Input must be a 6-character code.');
    }

    const alphabet = 'abcdefghijklmnopqrstuvwxyz'.toUpperCase() + '0123456789';
    const charMap = new Map();

    for (let i = 0; i < alphabet.length; i++) {
        charMap.set(alphabet[i], (i + shift) % alphabet.length);
    }

    const result = code.split('').map(char => {
        const shiftedChar = charMap.get(char.toUpperCase());
        return shiftedChar !== undefined ? alphabet[shiftedChar] : char;
    });

    return result.join('');
}

async function generateVerificationCode() {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        code += characters[randomIndex];
    }
    return code.toUpperCase();
}

async function generateLink(destination, ctx) {
    const existingEntry = await client.db(dbName).collection('Users').findOne({
        userId: ctx.callbackQuery.from.id
    });
    if (existingEntry.shortner === false) {
        const apiUrl = 'https://vplink.in/api';
        const apiKey = '2ad6aacb3fafe08448a1f897438505ff8e2023b8';

        const params = new URLSearchParams({
            api: apiKey,
            url: destination
        });

        const response = await fetch(`${apiUrl}?${params.toString()}`);
        const responseData = await response.json();
        if (responseData.status === 'success') {
            try {
                await client.db(dbName).collection('Users').updateOne({
                    userId: ctx.callbackQuery.from.id
                }, {
                    $set: {
                        shortner: true,
                    }
                });
                return responseData.shortenedUrl;
            } catch {
                console.log('Error in Genrating Link:', error.message);
            }
        }
    } else {
        const apiUrl = 'https://vplink.in/api';
        const apiKey = 'c9b00fb4faa537a7bd58cc1f807b62f561535bb3';

        const params = new URLSearchParams({
            api: apiKey,
            url: destination
        });

        const response = await fetch(`${apiUrl}?${params.toString()}`);
        const responseData = await response.json();
        if (responseData.status === 'success') {
            try {
                await client.db(dbName).collection('Users').updateOne({
                    userId: ctx.callbackQuery.from.id
                }, {
                    $set: {
                        shortner: false,
                    }
                });
                return responseData.shortenedUrl;
            } catch {
                console.log('Error in Genrating Link:', error.message);
            }
        }

    }
}

async function humanReadableFileSize(bytes) {
    const thresh = 1024; // adjust for IEC units (1024) or SI units (1000)
    if (Math.abs(bytes) < thresh) {
        return bytes + ' B';
    }
    const units = ['KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];
    let u = -1;
    const r = 10;
    do {
        bytes /= thresh;
        ++u;
    } while (Math.round(Math.abs(bytes) * r) / r >= thresh && u < units.length - 1);
    return bytes.toFixed(2) + ' ' + units[u];
}

///////////////////////////////////////////
async function wellcomeMessage(ctx) {
    const wellcomeMessage = `
    <b>HELLO <a href='tg://user?id=${ctx.message.from.id}'>${ctx.message.from.first_name}</a></b>
    Here You Can Get File. You Need to join our update channel and verify your token to get the file directly for 6 hours. Then verify your token again.
    `;
    return wellcomeMessage
}




async function checkAndUpdateUsers() {
    try {

        // Calculate 6 hours ago from now
        const sixHoursAgo = new Date();
        sixHoursAgo.setHours(sixHoursAgo.getHours() - 6);

        // Find users where vDate is older than 6 hours
        const query = {
            vDate: {
                $lt: sixHoursAgo
            }
        };
        const usersToUpdate = await client.db(dbName).collection('Users').find(query).toArray();

        // Update users
        const updatePromises = usersToUpdate.map(user => {
            return client.db(dbName).collection('Users').updateOne({
                _id: user._id
            }, {
                $set: {
                    isVerified: false,
                    vDate: 0
                }
            });
        });

        await Promise.all(updatePromises);

        console.log("Users checked and updated successfully.");
    } catch (error) {
        console.error('Error checking and updating users:', error);
    }
}

async function initializingBot() {
    try {
        await client.connect();
        const botSettingCollection = client.db(dbName).collection('BotSetting');
        const existingEntry = await botSettingCollection.findOne({
            botName: botUsername
        });

        if (!existingEntry) {
            await botSettingCollection.insertOne({
                botName: botUsername,
                shortLink: true,
                fsub: true
            });
            console.log('BotSetting created with shortLink set to ON.');
        }
    } catch (error) {
        bot.telegram.sendMessage(logId, `Error initializing BotSetting:\n${error}`);
    }
}


checkAndUpdateUsers();
setInterval(checkAndUpdateUsers, 5 * 60 * 1000);
initializingBot()

bot.launch().then(() => {
    console.log('Bot started');
}).catch((err) => {
    console.error('Error starting bot', err);
})
