const fs = require('fs')
const path = require('path')
const express = require('express')
const { SAVE_URL, NON_ALPHA_NUM } = require('./docs/bookmarks.js')
const INDEX = fs.readFileSync('./index.html').toString('utf-8')
const OUTPUT = path.resolve(path.join(__dirname, '.output'))
const { selectDom } = require('./select-tree.js')
const { BOOKMARKS_TREE } = require('./get-bookmarks.js')


// todo: make dynamic

function listBookmarkFolders(bookmarks) {
	return (bookmarks || []).map(folder => {
		return `<li>
  <label for="${folder.folder.replace(NON_ALPHA_NUM, '-')}">
    ${folder.folder}</label>
    ${folder.children && folder.children.length > 0
				? ('<ol>' + listBookmarkFolders(folder.children) + '</ol>')
				: ''}
</li>`
	}).join('\n')
}

function getBookmarks(bookmarksFile) {
	let htmlFile
	if(bookmarksFile && fs.existsSync(bookmarksFile)) {
		htmlFile = fs.readFileSync(bookmarkFile).toString('utf-8')
	} else {
		// TODO: get most recent bookmarks upload from .output
		const UPLOADS = fs.readdirSync(OUTPUT)
			.filter(a => a.endsWith('-html'))
			.map(a => path.join(OUTPUT, a))
		UPLOADS.sort((a, b) => fs.statSync(b).mtime - fs.statSync(a).mtime)
		htmlFile = fs.readFileSync(UPLOADS[0]).toString('utf-8')
	}

	let bookmarks = selectDom(BOOKMARKS_TREE, htmlFile)
	if(bookmarks[0] && bookmarks[0].folder && bookmarks[0].folder.startsWith('Bookmarks')) {
		bookmarks = bookmarks[0].children
	}
	if(bookmarks[0] && bookmarks[0].folder && bookmarks[0].folder.startsWith('Other Bookmarks')) {
		bookmarks = bookmarks[0].children
	}
	return bookmarks

}


function renderIndex() {
	let index = INDEX

	let bodyTag = index.match(/<ol class="bookmarks"[\n\r.^>]*?>/i)
	let offset = bodyTag.index
	let bookmarks = getBookmarks()
	index = index.substring(0, offset + bodyTag[0].length)
		+ listBookmarkFolders(bookmarks) 
		+ index.substring(offset + bodyTag[0].length, index.length)

	fs.writeFileSync(path.join(__dirname, 'docs/index.html'), index)
}

function randomKey(length = 8) {
	return Math.random().toString(16).substr(2, length);
}

function bookmarksToPDF(bookmarkFile, response) {
	if (bookmarkFile.endsWith('-html')) {
		let bookmarks = getBookmarks(bookmarkFile)
		response.setHeader('content-type', 'text/json')
		response.send(JSON.stringify(bookmarks[0]))
		return
	}

	// TODO: unzip contents into memory

	// TODO: import sqlite to make a smaller, more ubiquitous deck of flash cards

	// TODO: animate flash card transition with 3D game engine experience
	response.setCode(401).send('Error')
}


const RECENT_UPLOADS = {}

async function uploadFile(req, res, next) {
	// TODO: accept file uploads as minimal example, this took long because the machine is working against me
	let fileKey
	if (!fs.existsSync(OUTPUT)) {
		fs.mkdirSync(OUTPUT)
	}

	if (req.body.part == 0) {
		fileKey = randomKey(16)
		RECENT_UPLOADS[fileKey] = path.join(OUTPUT, req.body.name)
		fs.writeFileSync(RECENT_UPLOADS[fileKey], Buffer.from([]))
	} else {
		fileKey = req.body.key
	}

	if (req.body.data.length == 0 && req.body.part > 0) {
		// TODO: begin converstion process, will use Google takeout export first, because i can copy it from jupyter_ops, and i just did the sqlite solution for resume
		return await bookmarksToPDF(RECENT_UPLOADS[fileKey], res)
	}

	// i'd feel bad about looking this stuff up if there wasn't so much nuance everywhere else, is this a sign that programmers are progressively worse the longer they use a specific technology?
	fs.writeFileSync(RECENT_UPLOADS[fileKey], Buffer.from(req.body.data), { flag: 'a' })

	if (req.body.part == 0) {
		res.setHeader('content-type', 'text/plain')
		return res.send(fileKey)
	} else {
		res.setHeader('content-type', 'text/plain')
		return res.send('Ok')
	}
}

function loadContent(req, res, next) {
	let pathname = req.originalUrl
	if (pathname == '/') {
		pathname = '/index.html'
	}
	const filename = path.join(__dirname, '/docs/', req.originalUrl)
	if (pathname == '/index.html' && !fs.existsSync(filename)) {
		renderIndex()
	}
	if (fs.existsSync(filename)) {
		return res.sendFile(filename)
	}
	return next()
}

// TODO: PUT 405 error from NPM's `live-server`, no workaround listed, too complicated, not worth fighting about or fixing, good for simply static pages, not good for developing a server-side function


function startServer() {
	const app = express()
	app.enable('etag')
	app.set('etag', 'weak')
	app.use(express.json())
	app.use(loadContent)
	app.put(SAVE_URL, uploadFile)

	// TODO: nuance, none of these options work anymore, everything is broken, npm is infected or too much complexity to keep track of? why do so many tutorials have bad instructions? I must be living in some alternate reality of hell, https://stackoverflow.com/questions/10867052/cannot-serve-static-files-with-express-routing-and-no-trailing-slash

	//app.use(express.static(path.resolve(__dirname, './docs/')))
	//app.all('*', function(req, res) { res.redirect('/main/'); });
	//app.use('/', express.static(__dirname+'/docs'));

	const { createServer } = require('http')
	const httpServer = createServer(app).listen(8080)

}

module.exports = {
	startServer,
	renderIndex,
}
