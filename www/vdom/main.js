define([
    '/api/config?cb=' + Math.random().toString(16).substring(2),
    '/common/messages.js',
    '/common/crypto.js',
    '/common/realtime-input.js',
    '/common/convert.js',
    '/common/toolbar.js',
    '/common/cursor.js',
    '/bower_components/jquery/dist/jquery.min.js',
    '/customize/pad.js'
], function (Config, Messages, Crypto, realtimeInput, Convert, Toolbar, Cursor) {
    var $ = window.jQuery;
    var ifrw = $('#pad-iframe')[0].contentWindow;
    window.Ckeditor = ifrw.CKEDITOR;

    var userName = Crypto.rand64(8),
        toolbar;

    var Vdom = Convert.core.vdom,
        Hyperjson = Convert.core.hyperjson;

    window.Hyperjson = Hyperjson;

    var andThen = function () {
        $(window).on('hashchange', function() {
            window.location.reload();
        });
        if (window.location.href.indexOf('#') === -1) {
            window.location.href = window.location.href + '#' + Crypto.genKey();
            return;
        }

        var fixThings = false;
        var key = Crypto.parseKey(window.location.hash.substring(1));
        window.editor = Ckeditor.replace('editor1', {
            // https://dev.ckeditor.com/ticket/10907
            needsBrFiller: fixThings,
            needsNbspFiller: fixThings,
            removeButtons: 'Source,Maximize',
            // magicline plugin inserts html crap into the document which is not part of the
            // document itself and causes problems when it's sent across the wire and reflected back
            removePlugins: 'magicline,resize'
        });


        editor.on('instanceReady', function () {
            editor.execCommand('maximize');
            var documentBody = ifrw.$('iframe')[0].contentDocument.body;

            documentBody.innerHTML = Messages.initialState;

            var inner = documentBody;
            window.inner = inner;
            window.cursor = Cursor(Ckeditor, editor, inner);

            var $textarea = $('#feedback');

            var vdom1 = Convert.dom.to.vdom(inner);

            var applyHjson = function (shjson) {
                console.log("Applying HJSON");
                // before integrating external changes, check in your own
                vdom1 = Convert.dom.to.vdom(inner);
                // the authoritative document is hyperjson, parse it
                var authDoc = JSON.parse(shjson);
                // use the authdoc to construct a second vdom
                var vdom2 = Convert.hjson.to.vdom(authDoc);
                // diff it against your version
                var patches = Vdom.diff(vdom1, vdom2);
                // apply the resulting patches               
                Vdom.patch(inner, patches);
            };

            var onRemote = function (shjson) {
                // remember where the cursor is
                cursor.update()

                applyHjson(shjson);

                cursor.find();

                // put the cursor back where you left it
                cursor.replace();
            };

            var onInit = function (info) {
                // TODO initialize the toolbar
            };

            window.rti = realtimeInput.start($textarea[0], // synced element
                                    Config.websocketURL, // websocketURL, ofc
                                    userName, // userName
                                    key.channel, // channelName
                                    key.cryptKey, // key
                                    { // configuration :D
                                        doc: inner,

                                        onReady: function (info) {
                                            applyHjson($textarea.val());
                                            $textarea.trigger('keyup');
                                        },

                                        onRemote: onRemote,
                                        onInit: onInit,

                                        transformFunction : function (text, toTransform, transformBy) {
                                            /* FIXME 
                                                operational transform on json shouldn't be in all editors
                                                just those transmitting/expecting JSON
                                            */
                                            false && console.log({
                                                text: text,
                                                toTransform: toTransform,
                                                transformBy: transformBy
                                            });

                                            // returning **null** breaks out of the loop
                                            // which transforms conflicting operations
                                            // in theory this should prevent us from producing bad JSON
                                            return null;
                                        }
                                        /*
                                            FIXME NOT A REAL FUNCTION WONT WORK
                                            transformFunction: function (state0str, toTransform, transformBy) {
                                                var state1A = JSON.parse(Operation.apply(state0str, transformBy));
                                                var state1B = JSON.parse(Operation.apply(state0str, toTransform));
                                                var state0  = JSON.parse(state0str);
                                            }
                                        */
                                    });

            $textarea.val(JSON.stringify(Convert.dom.to.hjson(inner)));

            editor.on('change', function () {
                var hjson = Hyperjson.fromDOM(inner);

                $textarea.val(JSON.stringify(hjson));
                rti.bumpSharejs();
                cursor.update()
            });

            ['mouseup', 'keyup'].forEach(function (type) {
                editor.document.on(type, function (e) {
                    cursor.update();
                });
            });

        });
    };

    var interval = 100;
    var first = function () {
        if (Ckeditor = ifrw.CKEDITOR) {
            andThen();
        } else {
            console.log("Ckeditor was not defined. Trying again in %sms",interval);
            setTimeout(first, interval);
        }
    };

    $(first);
});
