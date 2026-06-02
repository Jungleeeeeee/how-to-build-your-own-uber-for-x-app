const dbOperations = require('./db/db-operations');
const mongoose = require('mongoose');

function initialize(server) {
	// Creating a new socket.io instance by passing the HTTP server object
	const io = require('socket.io')(server);

	io.on('connection', (socket) => { // Listen on the 'connection' event for incoming sockets
		console.log('A user just connected');

		socket.on('join', (data) => { // Listen to any join event from connected users
			socket.join(data.userId); // User joins a unique room/channel that's named after the userId
			console.log(`User joined room: ${data.userId}`);
		});

		// Listen to a 'request-for-help' event from connected civilians
		// Внутри функции initialize(server) найди или добавь этот обработчик:
socket.on("request-for-help", async (eventData) => {
    const requestId = 'req_' + Math.random().toString(36).substr(2, 9);
    const requestTime = new Date();
    const status = "waiting";

    // Сохраняем заявку в виртуальную базу данных
    await dbOperations.saveRequest(
        requestId, 
        requestTime, 
        {
            address: eventData.location.address,
            coordinates: [eventData.location.longitude, eventData.location.latitude]
        }, 
        eventData.civilianId, 
        status
    ).catch(err => console.error("Ошибка сохранения сокет-заявки:", err));

    // Рассылаем событие всем подключенным копам в реальном времени
    socket.broadcast.emit("request-for-help", {
        civilianId: eventData.civilianId,
        location: eventData.location
    });
});

		// Обработка принятия вызова сотрудником полиции
        socket.on('request-accepted', async (eventData) => {
            console.log('Вызов принят, данные события:', eventData);

            const requestId = eventData.requestDetails.requestId;
            const copId = eventData.copDetails.userId || eventData.copDetails.copId;

            // Обновляем статус заявки в БД
            await dbOperations.updateRequest(requestId, copId, 'engaged')
                .catch(err => console.error("Ошибка обновления статуса заявки:", err));

            // Отправляем глобальное событие ВСЕМ, передавая внутри civilianId
            io.emit('accepted', {
                targetCivilianId: eventData.requestDetails.civilianId,
                copDetails: eventData.copDetails
            });
        });

	});
}

exports.initialize = initialize;