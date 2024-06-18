const {

    Telegraf

} = require('telegraf');

const {

    MongoClient

} = require('mongodb');

require('dotenv').config();



const bot = new Telegraf('7176585147:AAETQUAgBIlsxLQprquJkQUUNV0K47nVV3o');

const client = new MongoClient('mongodb+srv://moviessearchbot:moviessearchbot@cluster0.gxqztlk.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0');



const admins = ['5397992078', '5606990991']

let logId = '-1002168567134'; // Log group Id

let dbId = '-1002008957712'; // db group Id

let channelId = '-1001874525841'; // fsub Id

let forwardChannelId = '-1002106510412' // auto send file link in channell id

let botUsername;

let botId;

const dbName = 'Pbot';



bot.telegram.getMe().then((botInfo) => {

    botUsername = botInfo.username;

    botId = botInfo.id;

});

client.connect().then(() => {}).catch(err => {

    bot.telegram.sendMessage(logId, `Error connecting to MongoDB in initializing Bot Setting :\n${err}`);

});



function main() {

    bot.telegram.sendMessage(logId, `Bot Restarted! 🌟`);

    // Error handling middleware

    bot.catch((err, ctx) => {

        console.error(`Encountered an error for ${ctx.updateType}`, err);

        if (err.code === 429 && err.description.includes('FLOOD_WAIT')) {

            const secondsToWait = parseInt(err.parameters.retry_after) || 10; // Default to waiting for 10 seconds

            console.log(`Waiting for ${secondsToWait} seconds before retrying...`);

            setTimeout(() => ctx.updateHandlerChain(), secondsToWait * 1000);

        } else {

            ctx.reply(`Sorry, something went wrong.\nError => ${err}`);

            bot.telegram.sendMessage(logId, `Start Command Error :\n${err}`);

        }

    });

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

    bot.command('setting', async (ctx) => {

        try {

            // Check if user is an admin and the chat is private

            if (admins.includes(String(ctx.message.from.id)) && ctx.message.chat.type === 'private') {

                // Fetch existing settings from the database

                const existingEntry = await client.db(dbName).collection('BotSetting').findOne({

                    botName: botUsername

                });

                // Determine button text based on settings

                let shortLinkButtonText, fsubButtonText;

                if (existingEntry.shortLink === true) {

                    shortLinkButtonText = '🟢 ON'

                } else {

                    shortLinkButtonText = '🔴 OFF'

                }

                if (existingEntry.fsub === true) {

                    fsubButtonText = '🟢 ON'

                } else {

                    fsubButtonText = '🔴 OFF'

                }

                // Define inline keyboard

                const keyboard = [

                    [{

                            text: 'Short Link',

                            callback_data: 'slink'

                        },

                        {

                            text: shortLinkButtonText,

                            callback_data: 'shortlinkonoff'

                        }

                    ],

                    [{

                            text: 'F Sub',

                            callback_data: 'fsub'

                        },

                        {

                            text: fsubButtonText,

                            callback_data: 'fsubonoff'

                        }

                    ],

                    [{

                        text: '❌ Close',

                        callback_data: 'home'

                    }]

                ];



                // Send reply with inline keyboard

                await ctx.reply('Bot Setting:', {

                    reply_markup: {

                        inline_keyboard: keyboard

                    },

                    reply_to_message_id: ctx.message.message_id

                });

            }

        } catch (error) {

            // Log the error

            console.error(`Setting Error: ${error}`);

            await bot.telegram.sendMessage(logId, `Setting Error:\n${error}`);

        }

    });

    async function displayStartMessage(ctx) {

        const startMessage = await welcomeMessage(ctx);

        const keyboard = [

            [{

                text: 'ℹ️ ABOUT',

                callback_data: 'about'

            }],

            [{

                text: '⚙ FEATURES',

                callback_data: 'features'

            }, {

                text: '✨ PREMIUM',

                callback_data: 'premium'

            }],

            [{

                text: 'UPDATE CHANNEL',

                url: 'https://t.me/Pbail_Movie_Channel'

            }],

            [{

                text: 'Movies Request Group',

                url: 'https://t.me/PbailMovieRequestGroup'

            }]

        ];

        const replyMarkup = {

            reply_markup: {

                inline_keyboard: keyboard

            }

        };

        const sentMessage = await ctx.replyWithHTML(startMessage, replyMarkup);

        return sentMessage.message_id;

    }

    // Function to handle pagination button clicks

    bot.on('callback_query', async (ctx) => {

        const data = ctx.callbackQuery.data.split('_');

        const action = data[0];

        const messageId = ctx.callbackQuery.message.message_id;

        // await ctx.answerCbQuery('Wait, generating Token...');

        if (action === 'about') {

            // Edit the existing message

            const keyboard = [

                [{

                    text: '🏠 Home',

                    callback_data: 'home'

                }]

            ];

            const replyMarkup = {

                reply_markup: {

                    inline_keyboard: keyboard

                }

            };

            await ctx.telegram.editMessageText(ctx.chat.id, messageId, null, await aboutMessage(ctx), {

                ...replyMarkup,

                parse_mode: 'HTML',

                disable_web_page_preview: true

            });

        } else if (action === 'features') {

            // Edit the existing message

            const keyboard = [

                [{

                    text: '🏠 Home',

                    callback_data: 'home'

                }]

            ];

            const replyMarkup = {

                reply_markup: {

                    inline_keyboard: keyboard

                }

            };

            await ctx.telegram.editMessageText(ctx.chat.id, messageId, null, await featuresMessage(ctx), {

                ...replyMarkup,

                parse_mode: 'HTML',

                disable_web_page_preview: true

            });

        } else if (action === 'premium') {

            // Edit the existing message

            const keyboard = [

                [{

                    text: '💎 Buy Premium',

                    callback_data: 'buypremium'

                }],

                [{

                    text: '🏠 Home',

                    callback_data: 'home'

                }]

            ];



            const replyMarkup = {

                reply_markup: {

                    inline_keyboard: keyboard

                }

            };

            await ctx.telegram.editMessageText(ctx.chat.id, messageId, null, await premiumMessage(ctx), {

                ...replyMarkup,

                parse_mode: 'HTML',

                disable_web_page_preview: true

            });

        } else if (action === 'home') {

            const keyboard = [

                [{

                    text: 'ℹ️ ABOUT',

                    callback_data: 'about'

                }],

                [{

                    text: '⚙ FEATURES',

                    callback_data: 'features'

                }, {

                    text: '✨ BUY PREMIUM',

                    callback_data: 'premium'

                }],

                [{

                    text: 'UPDATE CHANNEL',

                    url: 'https://t.me/anonymous_robots'

                }]

            ];

            const replyMarkup = {

                reply_markup: {

                    inline_keyboard: keyboard

                }

            };

            await ctx.telegram.editMessageText(ctx.chat.id, messageId, null, await welcomeMessage(ctx), {

                ...replyMarkup,

                parse_mode: 'HTML',

                disable_web_page_preview: true

            });

        } else if (action === 'buypremium') {

            ctx.answerCbQuery(`Coming Soon `, {

                show_alert: true

            })

        } else if (action === 'file') {

            try {

                const fileUniqueId = data[1];

                const verified = await isVerified(ctx);

                const member = await isUserMember(ctx);

                if (verified && member) {

                    await ctx.answerCbQuery('Sending File... 📤');

                    ctx.sendChatAction('upload_document');

                    const existingEntry = await client.db(dbName).collection('Files').findOne({

                        fileUniqueId: fileUniqueId

                    });

                    try {

                        if (existingEntry.fileId) {

                            const file = ctx.sendDocument(existingEntry.fileId, {

                                caption: `This file will be deleted after 10 minutes. Please forward it to another chat before downloading.`

                            });

                            bot.telegram.sendMessage(logId, `User: <a href='tg://user?id=${ctx.callbackQuery.from.id}'>${ctx.callbackQuery.from.first_name} Downloaded File Scussfuly</a>`, {

                                parse_mode: 'HTML'

                            });



                            await ctx.telegram.deleteMessage(ctx.chat.id, ctx.callbackQuery.message.message_id);



                            const deleteAfter = 10 * 60 * 1000;

                            setTimeout(async () => {

                                try {

                                    await ctx.deleteMessage((await file).message_id);

                                    ctx.reply(`File successfully 🚮 deleted after 10 minutes due to © copyright issues.`);

                                } catch (error) {

                                    bot.telegram.sendMessage(logId, `Error deleting message ${messageId}:`, error);

                                }

                            }, deleteAfter);

                        } else {

                            ctx.reply('File Not Found');

                            await ctx.telegram.deleteMessage(ctx.chat.id, ctx.callbackQuery.message.message_id);

                        }

                    } catch (error) {

                        bot.telegram.sendMessage(logId, `Send File Error:`, error);

                    }

                } else {

                    const code = await generateVerificationCode();

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

                    const tokenLink = `https://t.me/${botUsername}?start=t_${encryptedCode}_${fileUniqueId}_${messageId}`;

                    const verificationLink = await generateLink(tokenLink, ctx);



                    // Edit the existing message

                    let fileMessage = '';

                    const keyboard = [];

                    if (!member) {

                        keyboard.push([{

                      
