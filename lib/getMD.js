var co = require('co')
var request = require('request-promise')
var toMarkdown = require('to-markdown');
var fs = require('fs');
var Promise = require('bluebird');
var cheerio = require('cheerio')
var argv = require("minimist")(process.argv.slice(2));

// var r = toMarkdown('<h1>Hello world!</h1>');
// console.log(r)

function* getHTML(url){
   var html = (yield request(url)).toString()
   var $ = cheerio.load(html)
   html = $('.theiaPostSlider_slides').html()
   var length = $('._prev').eq(0).children('span').length
   var requestlist = []
   for(var i = 2;i <= length;i++){
    requestlist.push(request(url+'/'+i))
   }  
   var resultlist = yield Promise.all(requestlist)
   
   resultlist = resultlist.map(function(result){
       return cheerio.load(result.toString())('.theiaPostSlider_slides').html()
   })
   
   resultlist.unshift(html)
   var allhtml = resultlist.join('\n')
   return new Promise(function(resolve,reject){
       return resolve(allhtml)
   })
}
function toMD(html){
    var filter = ['div','script','span','a']
    var md = toMarkdown(html,{
    converters:[{
        filter:filter,
        replacement:function(innerHTML,node){
            if(node.nodeName == 'SCRIPT'){
                return ''
            }
            if(node.nodeName == 'SPAN'){
                return innerHTML
            }
            return innerHTML
        }
    }]})
    return new Promise(function(resolve,reject){
        autoTranslateMD(md).then(function(trsmd){
            return resolve(trsmd)
        }).catch(function(e){
            reject(e)
        })
    })
}
function getTranslateP(query){
    if(query == '' || query == '\n'){
        return new Promise(function(r){
            r({
                trans_result:{
                    data:[{
                        dst:'\n'
                    }]
                }
            })
        })
    }
    return request('http://fanyi.baidu.com/v2transapi',{
        method:'POST',
        json:true,
        form:{
            from:"auto",
            to:"auto",
            query:query,
        }
    })
}
function autoTranslateMD(md){
    return new Promise(function(resolve,reject){
        var trs_md = []
        for(var i = 0;i<md.split('\n').length;i++){
            trs_md.push(getTranslateP(md.split('\n')[i]))
        }
        Promise.all(trs_md).then(function(arr){
        var result  = ''
        arr.forEach(function(item){
            var _item = item.trans_result?item.trans_result.data[0].dst:'\n'    
            _item = _item
            .replace('*','* ')
            _item = _item            
            .replace('＊','* ')
            _item = _item            
            .replace('*  *','**')
            .replace('，】',',')
            .replace(new RegExp('。','g'),'.')
            _item = _item.replace(/(\d)\./,'$1. ')
            _item = _item.replace('：',':')
            .replace(new RegExp(' .jpg|. jpg','g'),'.jpg')
            .replace(new RegExp(' .png|. png','g'),'.png')
            .replace(new RegExp(' .gif|. gif','g'),'.gif')
            .replace(' #','#')
            .replace('！','!')
            .replace(/【/g,'[').replace(/】/g,']')
            .replace(new RegExp('（','g'),'(').replace(new RegExp('）','g'),') ')
            .replace(new RegExp(' /','g'),'/').replace(new RegExp('/ ','g'),'/')
            .replace(/jpg[^)]+/,'jpg')
            .replace(/gif[^)]+/,'gif')                
            .replace(/![^(]+/,'![]')                
            .replace('三.','3. ')
            // .replace(new RegExp('**资源+'),'3. ')                
            +'\n'
            result += _item
        })
       resolve(result)
    }).catch(function(e){
        reject(e)
    })})
}
function getMD(opt){
    return new Promise(function(resolve,reject){
        co(getHTML(opt.url)).then(function(allhtml){
            toMD(allhtml).then(function(md){
                return resolve(md)
            })
        })
    }).catch(function(e){
        reject(e)
    })
}

function getContent(opt){
    return new Promise(function(resolve,reject){
        co(getHTML(opt.url)).then(function(allhtml){
            toMD(allhtml).then(function(md){
                return resolve(md)
            })
        })
    }).catch(function(e){
        reject(e)
    })
}
function getSummary(opt){
    return new Promise(function(resolve,reject){
        request(opt.url).then(function(html){
            html = html.toString()
            var $ = cheerio.load(html)
            
            var allRequest = [
            getTranslateP($('title').text()),
            getTranslateP($('.theiaPostSlider_slides').find('p').eq(0).text()),
            getTranslateP($('.theiaPostSlider_slides').find('img').eq(0).attr('src'))
            ]            
            return Promise.all(allRequest)
        }).then(function(arr){
            var json = {};
            json.title = arr[0].trans_result.data[0].dst
            json.desc = arr[1].trans_result.data[0].dst
            json.mainpic = arr[2].trans_result.data[0].dst
            resolve(json)
        })
    }).catch(function(e){
        reject(e)
    })
}

module.exports.getContent = getContent
module.exports.getSummary = getSummary
