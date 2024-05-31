/*
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const bcrypt = require('bcryptjs');
const { engine } = require('express-handlebars');
const nodemailer = require('nodemailer');
const cors = require('cors');
require('dotenv').config();
const ChatConfig = require('./models/ChatConfig');
const Handlebars = require('handlebars');
const { allowInsecurePrototypeAccess } = require('@handlebars/allow-prototype-access');
const Ollama = require("@langchain/community/llms/ollama");

*/
// Importa los módulos necesarios usando la sintaxis ES6
import express from 'express';
import mongoose from 'mongoose';
import bodyParser from 'body-parser';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import bcrypt from 'bcryptjs';
import { engine } from 'express-handlebars';
import nodemailer from 'nodemailer';
import cors from 'cors';
import dotenv from 'dotenv';
import ChatConfig from './models/ChatConfig.js';  // Asegúrate de que ChatConfig tiene un export default o named
import Handlebars from 'handlebars';
import { allowInsecurePrototypeAccess } from '@handlebars/allow-prototype-access';
import { Ollama } from "@langchain/community/llms/ollama";
import { LLMChain, SequentialChain, SimpleSequentialChain } from "langchain/chains";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { NodeVM } from 'vm2';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fileUpload from 'express-fileupload';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { RunnableSequence } from '@langchain/core/runnables';

// Para obtener la ruta del archivo actual en un módulo ES
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);




const app = express();
const PORT = process.env.PORT || 3003;
const endpointUrl = "/endpoints/"
const chatUrl = "/chats/"
// Conexión a MongoDB
const mongoDB = 'mongodb://127.0.0.1:27017/chachachats';
mongoose.connect(mongoDB);

mongoose.connection.on('connected', () => {
    console.log('Mongoose is connected to the database.');
});

mongoose.connection.on('error', (err) => {
    console.log('Mongoose failed to connect to the database:', err);
});

// Configuración de CORS para permitir todas las solicitudes
app.use(cors());
app.use(express.static('public'));
app.use(fileUpload());

// Middleware para parsear JSON y formularios
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Motor de plantillas Handlebars
app.engine('hbs', engine({
    extname: '.hbs',
    defaultLayout: 'main',
        handlebars: allowInsecurePrototypeAccess(Handlebars),
    helpers: {
        json: function(context) {
            return JSON.stringify(context);
        }
    }
}));
app.set('view engine', 'hbs');
app.set('views', './views');

app.use((req, res, next) => {
    console.log(`Incoming request: ${req.method} ${req.path}`);
    next();
});

// Configuración de sesión
app.use(session({
    secret: 'super secret',
    resave: false,
    saveUninitialized: true,
    store: MongoStore.create({ mongoUrl: 'mongodb://127.0.0.1:27017/chachachats' })
}));


// Middleware para verificar si el usuario está logueado
function isAuthenticated(req, res, next) {
    if (req.session && req.session.user) {
        return next();
    } else {
        //res.status(401).send('You are not authorized to view this page');
        res.redirect('/login');
    }
}
// Ruta para mostrar el formulario de login
app.get('/login', (req, res) => {
    res.render('login');
});

// Ruta para manejar el proceso de login
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    // Aquí deberías verificar las credenciales correctamente
    if (username === "admin" && password === "password") {
        req.session.user = {username: username};
        res.redirect('/chats');
    } else {
        res.send('Invalid username or password');
    }
});

// Ruta para cerrar sesión
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});



// Rutas
app.get('/', (req, res) => res.render('home'));
//app.get('/login', (req, res) => res.render('login'));
app.get('/chats', isAuthenticated, async (req, res) => {
    const chats = await ChatConfig.find();
    //const endpointUrl = "/endpoints/"
    const baseUrl = "http://" + req.get('host') + chatUrl;
    const endpointUrl = "http://" + req.get('host') + "/enpoints/";
    res.render('chat-list', { chats, baseUrl, endpointUrl, chatUrl });
});
app.get('/chats/new', isAuthenticated, (req, res) => {
    console.log("Rendering new chat form with:", { chat: {} });
    res.render('chat-edit', { chat: {}});
});
app.get('/chats/edit/:id', isAuthenticated, async (req, res) => {
    const chat = await ChatConfig.findById(req.params.id);
    res.render('chat-edit', { chat });
});
app.post('/chats/new', isAuthenticated, async (req, res) => {
    try {
    const newChat = new ChatConfig({
        chatId: req.body.chatId,
        name: req.body.name,
        notes: req.body.notes,
    });
        req.body.codeSnippet? newChat.codeSnippet = req.body.codeSnippet : null;
        req.body.configuration? newChat.configuration = JSON.parse(req.body.configuration) : null;
    await newChat.save();
    res.redirect('/chats');
    } catch (error) {
        console.error('Error creating chat:', error);
        res.status(500).send('Error creating chat');
    }
});
app.post('/chats/edit/:id', isAuthenticated, async (req, res) => {
    try {
    await ChatConfig.findByIdAndUpdate(req.params.id, {
        chatId: req.body.chatId,
        name: req.body.name,
        notes: req.body.notes,
        configuration: JSON.parse(req.body.configuration),
        codeSnippet: req.body.codeSnippet
    });
    res.redirect('/chats');
    } catch (error) {
        console.error('Error updating chat:', error);
        res.status(500).send('Error updating chat');
    }
});
// Eliminar un chat
app.post('/chats/delete/:id', isAuthenticated, async (req, res) => {
    try {
        await ChatConfig.findOneAndDelete({ _id: req.params.id });
        res.redirect('/chats');
    } catch (error) {
        console.error('Error deleting chat:', error);
        res.status(500).send('Error deleting chat');
    }
});

// Ruta para servir la aplicación compilada con la configuración del chat
app.get(`${chatUrl}:chatId`, async (req, res) => {
    try {
        const chatId = req.params.chatId;
        const chat = await ChatConfig.findOne({ chatId });

        if (!chat) {
            return res.status(404).send('Chat not found');
        }

        // Asegúrate de que `indexPath` apunta correctamente al archivo index.html
        const indexPath = path.join(__dirname, 'public', 'chachachat', 'index.html');
        
        // Leer el archivo index.html de forma asíncrona
        const data = await fs.readFile(indexPath, 'utf8');

        // Inyectar el script con el endpoint
        const configScript = `<script>
            window.chachachatEndpoint = "${req.protocol}://${req.get('host')}/api/config/${chatId}";
        </script>`;
        const updatedHtml = data.replace('</head>', `${configScript}</head>`);

        // Enviar el HTML modificado
        res.send(updatedHtml);
    } catch (error) {
        console.error('Error fetching chat:', error);
        res.status(500).send('Server error');
    }
});

// Ruta para exportar un chat específico a un archivo JSON
app.get('/chats/export/:id', isAuthenticated, async (req, res) => {
    try {
        const chat = await ChatConfig.findById(req.params.id);
        if (!chat) {
            return res.status(404).send('Chat not found');
        }
        const filePath = path.join(process.cwd(), `chat_${chat.chatId}.json`);
        await fs.writeFile(filePath, JSON.stringify(chat, null, 2));
        res.download(filePath, `chat_${chat.chatId}.json`, () => {
            // Elimina el archivo temporal después de la descarga
            fs.unlink(filePath);
        });
    } catch (error) {
        console.error('Error exporting chat:', error);
        res.status(500).send('Error exporting chat');
    }
});

app.post('/chats/import', isAuthenticated, async (req, res) => {
    if (!req.files || !req.files.chatsFile) {
        return res.status(400).send('No file uploaded');
    }

    try {
        const chatsFile = req.files.chatsFile;
        const chats = JSON.parse(chatsFile.data.toString());

        // Verificar si es un solo chat o una lista de chats
        const chatsArray = Array.isArray(chats) ? chats : [chats];

        for (const chat of chatsArray) {
            const oldChatId = chat.chatId;
            const newChatId = uuidv4();

            // Convertir el objeto a una cadena JSON
            let chatString = JSON.stringify(chat);

            // Reemplazar todas las instancias del oldChatId con newChatId en la cadena JSON
            const regex = new RegExp(oldChatId, 'g');
            chatString = chatString.replace(regex, newChatId);

            // Convertir de nuevo a objeto JSON
            const updatedChat = JSON.parse(chatString);
            updatedChat._id = undefined; // Dejar que MongoDB genere un nuevo _id

            await ChatConfig.create(updatedChat);
        }

        res.redirect('/chats');
    } catch (error) {
        console.error('Error importing chats:', error);
        res.status(500).send('Error importing chats');
    }
});

/*
app.get(`${chatUrl}:chatId`, async (req, res) => {
    try {
        //const chat = await ChatConfig.findById(req.params.chatId).select('-codeSnippet');
        const chat = await ChatConfig.findOne({ chatId: req.params.chatId }).select('-codeSnippet');
        if (!chat) {
            return res.status(404).send('Chat not found');
        }

        res.render('chat-details', {
            layout: 'chat-layout', // Especifica el layout alternativo aquí
            chat: chat
        });
    } catch (error) {
        console.error('Error fetching chat:', error);
        res.status(500).send('Server error');
    }
});
*/

app.get('/api/config/:chatId', async (req, res) => {
    try {
        const chatId = req.params.chatId;

        // Encuentra el chat con el `chatId` especificado
        const chat = await ChatConfig.findOne({ chatId });

        // Si no se encuentra el chat, retorna un error 404
        if (!chat) {
            return res.status(404).json({ error: 'Chat not found' });
        }

        // Devuelve la configuración como JSON
        res.json({
            name: chat.name,
            notes: chat.notes,
            configuration: chat.configuration
        });
    } catch (error) {
        console.error('Error fetching chat configuration:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


app.post('/api/endpoints/:chatId', async (req, res) => {
    try {
        const chatId = req.params.chatId;
        const { model, prompt, context, stream } = req.body; // Asume que el texto a traducir se pasa como 'textToTranslate' en el cuerpo

        console.log("Body of the request:");
        console.log(req.body);

        const chat = await ChatConfig.findOne({ chatId });
        if (!chat) {
            return res.status(404).json({ error: 'Chat configuration not found' });
        }
        

        if(!chat.codeSnippet){
            console.log("There is no codesnippet, we use basic ollama call with langchain");

            const ollama = new Ollama({
                        baseUrl: "http://localhost:11434",
                        model: model,
                        context: context
                    });
            if(!stream){
                const ollamaGenerate = await ollama.generate([prompt]);
                console.log("No Stream");
                console.log(ollamaGenerate.generations[0][0]);
                res.json({
                    response: ollamaGenerate.generations[0][0].text 
                })

            }else{
                // Inicia el stream con el texto del cuerpo
                const ollamaStream = await ollama.stream(prompt);
                // Envía los datos a medida que se reciben desde el stream
                console.log("Stream");
                res.setHeader('Content-Type', 'text/plain');

                for await (const chunk of ollamaStream) {
                    res.write(chunk);
                    //console.log(chunk);
                }
                // Cierra la conexión después de finalizar el stream
                res.end();
            }

        }else{
            console.log("codeSnippet found, we use langchain's codesnippet");
        
            // Si el chat tiene un snippet de código, intenta ejecutarlo
            if (chat.codeSnippet) {
                //let output = eval(chat.codeSnippet);
                const vm = new NodeVM({
                    console: 'inherit',
                    sandbox: { 
                        Ollama, res, prompt, model, 
                        context, req, stream, 
                        PromptTemplate, LLMChain, StringOutputParser,
                        SimpleSequentialChain, SequentialChain , RunnableSequence
                    },  // El contexto en el que se ejecutará el código
                    require: {
                    external: true,  // Deshabilita el acceso a módulos externos
                    builtin: [],  // No permite el uso de módulos integrados
                    root: null,  // No se especifica un directorio raíz
                    mock: {},  // No se usa ningún módulo mock
                    }
                });

                try {
                // Ejecuta el código proporcionado en el entorno del `vm`
                await vm.run(`
                    (async () => {
                        ${chat.codeSnippet}
                    })()
                `);

                // Asegúrate de que `res.end()` se maneje correctamente dentro del snippet
                if (!stream) {
                    res.end();
                }
            } catch (err) {
                console.error('VM error:', err);
                res.status(500).json({ error: 'Error executing code snippet' });
            } 
            } else {
                res.status(404).send("No code snippet available for this chat.");
            }

         }

    } catch (error) {
        console.error('Error fetching chat configuration:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


app.post('/api/endpoints/ollama/:chatId', async (req, res) => {
    try {
        const chatId = req.params.chatId;

        // Encuentra el chat con el `chatId` especificado
        const chat = await ChatConfig.findOne({ chatId });

        // Si no se encuentra el chat, retorna un error 404
        if (!chat) {
            return res.status(404).json({ error: 'Chat not found' });
        }

        const ollama = new Ollama({
            baseUrl: "http://localhost:11434", // Default value
            model: "phi3", // Default value
        });

        const stream = await ollama.stream(
            `Translate "I love programming" into German.`
        );

        const chunks = [];
            for await (const chunk of stream) {
            chunks.push(chunk);
        }


        console.log(chunks.join(""));
        // Devuelve la configuración como JSON
        res.json({
            name: chat.name,
            notes: chat.notes,
            configuration: chat.configuration,
            codeSnippet: chat.codeSnippet
        });
    } catch (error) {
        console.error('Error fetching chat configuration:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});







// Endpoint para enviar correos electrónicos
app.post('/send-email', (req, res) => {
  const { to, subject, text, extra } = req.body;

  const mailOptions = {
    from: 'miChatBot@gmail.com', // Cambia a la dirección que quieras mostrar como remitente
    to: to,
    subject: subject,
    text: text,
  };

  console.log(req.body);

  // Configura el transporter para usar SMTP con las configuraciones de tu organización
const transporter = nodemailer.createTransport({
  host: 'smtp.tuorganizacion.com',
  port: 587,
  secure: false, // true para 465, false para otros puertos
  auth: {
    user: 'tuusuario',
    pass: 'tucontraseña'
  },
  tls: {
    // Esta opción es necesaria si el servidor está detrás de un proxy o utiliza un certificado auto-firmado
    rejectUnauthorized: false
  }
});

//res.status(200).send({ message: 'Correo enviado con éxito', response: "funciona" });
// Ejemplo de cómo enviar un correo
transporter.sendMail(
    mailOptions, (error, info) => {
  if (error) {
    console.log('Error al enviar correo:', error);
    return res.status(500).send({ message: "Error al enviar el correo", error: error.toString() });
  } else {
    console.log('Correo enviado:', info.response);
    res.status(200).send({ message: 'Correo enviado con éxito', response: info.response });
  }
});
});





// Inicia el servidor
app.listen(PORT, () => {
  console.log(`Servrer listening at http://localhost:${PORT}`);
});
