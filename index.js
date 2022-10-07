const fs = require('fs')
const path = require('path')
const express = require('express')
const puppeteer = require('puppeteer')
const { SAVE_URL } = require('./docs/bookmarks.js')
const INDEX = fs.readFileSync('./index.html').toString('utf-8')
const OUTPUT = path.resolve(path.join(__dirname, '.output'))
const { selectDom } = require('./select-tree.js')
const { BOOKMARKS_TREE } = require('./get-bookmarks.js')

const PDF_URL = '/pdf'
const SCREENSHOT_URL = '/screenshot'
const NON_ALPHA_NUM = (/[^abcdefghijklmnopqrstuvwxyz0123456789]/gi)


// todo: make dynamic

function listBookmarkStyles(bookmarks) {
	return (bookmarks || []).map(folder => {
		let safeName = folder.folder.replace(NON_ALPHA_NUM, '_')
		return `
	input[name="${safeName}"]:checked ~ * label[for="${safeName}"] + ol {
		display: block;
	}

	input[name="${safeName}"].active ~ * ul.${safeName} {
		display: block;
	}

	#thumbs:checked ~ input[name="${safeName}"].active ~ .container.links ul.${safeName} {
		display: flex;
	}

	

	${folder.children && folder.children.length > 0
		? (listBookmarkStyles(folder.children))
		: ''}`
	}).join('\n')
}


function listBookmarkToggle(bookmarks) {
	return (bookmarks || []).map(folder => {
		let safeName = folder.folder.replace(NON_ALPHA_NUM, '_')
		return `<input class="folder-toggle" type="checkbox" id="${safeName}" name="${safeName}" />
				${folder.children && folder.children.length > 0
					? (listBookmarkToggle(folder.children))
					: ''}`
	}).join('\n')
}


function listBookmarkLinks(bookmarks) {
	return (bookmarks || []).map(folder => {
		let safeName = folder.folder.replace(NON_ALPHA_NUM, '_')
		return `
	<ul class="${safeName}">
		${folder.links ? (folder.links.map(link => {
			return `<li style="background-image:url('${SCREENSHOT_URL}/${encodeURIComponent(link.url)}');">
			<a href="${link.url}" target="_blank">
				${link.title}</a></li>`
		}).join('\n')) : ''}
	</ul>
	${folder.children && folder.children.length > 0
		? (listBookmarkLinks(folder.children))
		: ''}`
	}).join('\n')
}


function listBookmarkFolders(bookmarks, level) {
	return (bookmarks || []).map(folder => {
		let safeName = folder.folder.replace(NON_ALPHA_NUM, '_')
		return `
		<li><label for="${safeName}">${folder.folder}</label>
    ${folder.children && folder.children.length > 0
				? (`<ol class="${safeName}">${
						listBookmarkFolders(folder.children, (level || '') + ' ' + safeName)}</ol>`)
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
	let bookmarks = getBookmarks()
	let index = INDEX

	let bodyTag = index.match(/<ol class="bookmarks"[^>]*?>/i)
	let offset = bodyTag.index
	index = index.substring(0, offset + bodyTag[0].length)
		+ listBookmarkFolders(bookmarks) 
		+ index.substring(offset + bodyTag[0].length, index.length)

	bodyTag = index.match(/<\/head>/i)
	offset = bodyTag.index
	index = index.substring(0, offset)
		+ '<style type="text/css">' + listBookmarkStyles(bookmarks) + '</style></head>'
		+ index.substring(offset + bodyTag[0].length, index.length)

	bodyTag = index.match(/<input name="folder-toggle" \/>/i)
	offset = bodyTag.index
	index = index.substring(0, offset)
		+ listBookmarkToggle(bookmarks)
		+ index.substring(offset + bodyTag[0].length, index.length)

	bodyTag = index.match(/<ul class="links"[\n\r.^>]*?>/i)
	offset = bodyTag.index
	index = index.substring(0, offset)
		+ listBookmarkLinks(bookmarks) 
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

async function getScreenshot(req, res, next) {
	const url = req.originalUrl.substr(SCREENSHOT_URL.length + 1)
	const decodedUrl = decodeURIComponent(url)
	const filePath = decodedUrl.replace(NON_ALPHA_NUM, '_')
	const outputPath = path.join(OUTPUT, filePath + '.png')
	if(!fs.existsSync(outputPath)) {
		const browser = await puppeteer.launch()
		const page = await browser.newPage()
		console.log(decodedUrl)
		await page.goto(decodedUrl)
		const temporaryKey = randomKey(16)
		await page.screenshot({
			path: path.join(OUTPUT, temporaryKey + '.png'),
			fullPage: true
		})
		browser.close()
		fs.renameSync(path.join(OUTPUT, temporaryKey + '.png'), outputPath)
	}
	return res.sendFile(outputPath)
}

// TODO: PUT 405 error from NPM's `live-server`, no workaround listed, too complicated, not worth fighting about or fixing, good for simply static pages, not good for developing a server-side function


function startServer() {
	const app = express()
	app.enable('etag')
	app.set('etag', 'weak')
	app.use(express.json())
	app.use(loadContent)
	app.use(SCREENSHOT_URL, getScreenshot)
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
