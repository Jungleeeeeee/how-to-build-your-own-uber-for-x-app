const http = require('http');
const express = require('express');
const consolidate = require('consolidate');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const fs = require('fs'); // Модуль для чтения файлов данных
const { MongoMemoryServer } = require('mongodb-memory-server'); // Виртуальная БД

const routes = require('./routes'); 
const socketEvents = require('./socket-events');

const app = express();

app.use(bodyParser.urlencoded({
    extended: true,
}));

app.use(bodyParser.json({
    limit: '5mb'
}));

app.set('views', 'views'); 
app.use(express.static('./public')); 
app.use('/libs/leaflet', express.static('./node_modules/leaflet/dist'));
app.use('/libs/axios', express.static('./node_modules/axios/dist'));

app.set('view engine', 'html');
app.engine('html', consolidate.handlebars); 

app.use('/', routes);

const server = http.Server(app);
const portNumber = 8000; 

// Функция автоматического старта встроенной БД и импорта данных
async function startApp() {
    console.log('Запуск встроенного сервера MongoDB...');
    
    // Создаем виртуальную базу данных на порту 27017
    const mongoServer = await MongoMemoryServer.create({
        instance: { port: 27017, dbName: 'uberForX' }
    });
    
    const dbUri = mongoServer.getUri();
    
    // Подключаем mongoose к созданной виртуальной базе
    await mongoose.connect(dbUri);
    console.log('✅ Встроенная база данных успешно подключена!');

    // Автоматический импорт тестовых данных из папки db
    const nativeDb = mongoose.connection.db;

     try {
        // Стандартное чтение чистого JSON для копов
        const copsData = JSON.parse(fs.readFileSync('./db/cops.json', 'utf8'));
        await nativeDb.collection('cops').insertMany(copsData);
        console.log('🔹 Данные полицейских успешно импортированы.');

        // Стандартное чтение чистого JSON для преступлений
        const requestsData = JSON.parse(fs.readFileSync('./db/crime-data.json', 'utf8'));
        await nativeDb.collection('requests').insertMany(requestsData);
        console.log('🔹 Данные преступлений успешно импортированы.');
    } catch (importError) {
        console.log('Предупреждение при импорте (возможно данные уже есть):', importError.message);
    }

    // Запускаем веб-сервер и сокеты только ПОСЛЕ старта базы данных
    server.listen(portNumber, () => { 
        console.log(`🚀 Сервер запущен! Открой в браузере: http://localhost:${portNumber}`);
        socketEvents.initialize(server);
    });
}

// Запускаем наше приложение
startApp().catch(error => {
    console.error('Ошибка критического запуска приложения:', error);
});