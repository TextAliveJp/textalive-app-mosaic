import { Player, stringToDataUrl } from "textalive-app-api";

/**
 * 
 * 歌詞内の文字列を用いて、モザイク状に歌詞を表示するデモ
 * 
 */
class Main
{
    constructor ()
    {
        var canMng = new CanvasManager();
        this._canMng = canMng;

        this._initPlayer();

        window.addEventListener("resize", () => this._resize());
        this._update();
    }
    // プレイヤー初期化
    _initPlayer ()
    {
        var player = new Player({
            app: {
                // トークンは https://developer.textalive.jp/profile で取得したものを使う
                token: "JYDH8RrdzBRmvSLL"
            },
            mediaElement: document.querySelector("#media")
        });
        
        player.addListener({
            onAppReady: (app) => this._onAppReady(app),
            onVideoReady: (v) => this._onVideoReady(v),
            onTimeUpdate: (pos) => this._onTimeUpdate(pos)
        });
        this._player = player;
    }
    // アプリ準備完了
    _onAppReady (app)
    {
        if (! app.songUrl)
        {
            this._player.createFromSongUrl("https://www.youtube.com/watch?v=-6oxY-quTOA", {
                // 歌詞タイミングをバージョン固定
                video: {
                    lyricId: 49058,
                    lyricDiffId: 2559
                },
                // 歌詞テキストを固定
                altLyricsUrl: stringToDataUrl(`
                    ほんとのコト　ほんとのキモチだけ　伝えられたらいいのにね　なんて
                    ときどき　考えたりするけど　そうそう　うまくはいかないみたいね
                    
                    たとえば　そう　愛想よく笑うあの子の真似とかしたりもするけど
                    たいてい　うわべだけで　どうにも　こうにも　なんとも　ならないもので
                    
                    それでも　ほら　キミが笑ってる　まわりはいつも別世界で
                    ふとしたとき　目と目があったら　ソワソワしちゃう　キミのせいだから
                    
                    恋のロンリ的に　誇大妄想　集中砲火で
                    キミのコトバのひとつひとつに　撃ち抜かれたハートは
                    たえず　不安定で　ときどき　転びそうにもなるけど
                    そっと　支えてくれる　そういうところが好きなのさ
                    
                    いつものコト　ありふれたコトバさえ　出てこなくて　モヤモヤしたりね
                    なんてね　悩んだりもするけど　そうそう　答えはみつからないのね
                    
                    たとえば　そう　曲がり角曲がって　偶然キミと出会ったときには
                    アタフタしてばかりで　どうにも　こうにも　なんとも　ならないもので
                    
                    それでも　ほら　キミが見つめてる　まわりはいつも別次元で
                    なにもかもが　ちっぽけに見える　机の上に答えは無いから
                    
                    恋のカガク的に　荒唐無稽　絵空事でも
                    キミの傍にいたいの　コトバなんていらないくらいに
                    たえず　隣にいて　持ちつ持たれつ　もたれかかりつで
                    そっと　手と手取り合う　そういう二人になりたいのさ
                    
                    恋のロンリ的に　矛盾だらけの　夢物語で
                    キミの右手左手　つかまえて離さないくらいは
                    たえず　空回りで　ときどき　転びそうにもなるけど
                    そっと　抱えてくれる　そういうところが好きなのさ
                `)
            });
        }

        // 画面クリックで再生／一時停止
        document.getElementById("view").addEventListener("click", () => function(p){ 
            if (p.isPlaying) p.requestPause();
            else             p.requestPlay();
        }(this._player));
    }
    // ビデオ準備完了
    _onVideoReady (v)
    {
        // 歌詞のセットアップ
        var lyrics = [];
        if (v.firstChar)
        {
            var c = v.firstChar;
            while (c)
            {
                lyrics.push(new Lyric(c));
                c = c.next;
            }
        }
        this._canMng.setLyrics(lyrics);
    }
    // 再生位置アップデート
    _onTimeUpdate (position)
    {
        this._position   = position;
        this._updateTime = Date.now();

        this._canMng.update(position);
    }

    _update ()
    {
        if (this._player.isPlaying && 0 <= this._updateTime && 0 <= this._position)
        {
            var t = (Date.now() - this._updateTime) + this._position;
            this._canMng.update(t);
        }
        window.requestAnimationFrame(() => this._update());
    }
    _resize ()
    {
        this._canMng.resize();
    }
}

class Lyric
{
    constructor (data)
    {
        this.text      = data.text;      // 歌詞文字
        this.startTime = data.startTime; // 開始タイム [ms]
        this.endTime   = data.endTime;   // 終了タイム [ms]
        this.duration  = data.duration;  // 開始から終了迄の時間 [ms]

        if (data.next && data.next.startTime - this.endTime < 500) this.endTime = data.next.startTime;
        else this.endTime += 500;
    }
}

class CanvasManager
{
    constructor ()
    {
        // 画面縦横の内、短辺のグリッド数
        this._size = 32;

        // キャンバス（歌詞の文字のピクセルを走査して、塗りの密度を調べる用）
        this._tcan;
        this._tctx;
        
        // キャンバス生成（描画エリア）
        this._can = document.createElement("canvas");
        this._ctx = this._can.getContext("2d");
        document.getElementById("view").append(this._can);

        this.resize();
    }

    // 歌詞の更新
    setLyrics (lyrics)
    {
        this._lyrics = lyrics;

        var size = this._size;
        var can = this._tcan = (!this._tcan) ? document.createElement("canvas") : this._tcan;
        var ctx = this._tctx = (!this._tctx) ? can.getContext("2d") : this._tctx;
        can.width = can.height = size;
        
        var fontSize = size * 0.9;

        ctx.textAlign = "center";
        ctx.fillStyle = "#000";
        ctx.font = "" + fontSize + "px sans-serif";

        var len = lyrics.length;
        var lyricsObj = {};
        var lyricsArr = [];

        // 歌詞の全文字列に対して走査
        for (var i = 0; i < len; i ++)
        {
            var text = lyrics[i].text;
            if (lyricsObj[text]) continue;

            lyricsObj[text] = this._getLyricObj(text, size, fontSize);
            lyricsArr.push(lyricsObj[text]);
        }

        // 歌詞の文字数が少ない場合に、追加で固定の文字列を加える
        if (lyricsArr.length < 10)
        {
            var str = "てきすとあらいぶテキストアライブ産業技術総合研究所";
            for (var i = 0; i < str.length; i ++)
            {
                var text = str.charAt(i);
                if (lyricsObj[text]) continue;

                lyricsObj[text] = this._getLyricObj(text, size, fontSize);
                lyricsArr.push(lyricsObj[text]);
            }
        }
        // 塗りの密度の低い順に並び替え
        lyricsArr = lyricsArr.sort(function(a,b) { return (a.ave < b.ave) ? -1:1; });
        
        this.lyricsObj = lyricsObj;
        this.lyricsArr = lyricsArr;
    }
    // 再生位置アップデート
    update (position)
    {
        if (! this._lyrics) return;

        // モザイク描画の更新頻度を調整（35ms毎）
        var tt = Math.floor(position / 35);
        if (this._tt == tt) return;
        this._tt = tt;

        for (var i = 0, l = this._lyrics.length; i < l; i ++)
        {
            var lyric = this._lyrics[i];
            // 開始タイム < 再生位置 && 再生位置 < 終了タイム
            if (lyric.startTime <= position && position < lyric.endTime)
            {
                this._draw(lyric.text);
                return;
            }
        }
        this._draw(null);
    }
    // リサイズ
    resize ()
    {
        this._can.width  = this._stw = document.documentElement.clientWidth;
        this._can.height = this._sth = document.documentElement.clientHeight;
    }

    // 指定の文字ピクセルを走査し、塗りの密度を調べる
    _getLyricObj (text, size, fontSize)
    {
        var ctx = this._tctx;

        ctx.clearRect(0, 0, size, size);
        ctx.fillText(text, size/2, size/2 + fontSize * 0.37);

        var image = ctx.getImageData(0, 0, size, size);
        var data  = image.data;

        var obj = {text: text, data: [], sum: 0, ave: 0, min: 255, max: 0};

        for (var n = 0, l = data.length; n < l; n += 4)
        {
            var alp = data[n+3];
            if (alp < obj.min) obj.min = alp;
            if (obj.max < alp) obj.max = alp;
            obj.sum += alp;
            obj.data.push(alp);
        }
        obj.ave = obj.sum / (size * size);

        return obj;
    }
    // 描画
    _draw (tx)
    {
        var size = this._size;

        var blockSize = Math.min(this._stw, this._sth) / size;
        var fontSize = blockSize * 0.9;

        var ctx = this._ctx;
        ctx.textAlign = "center";
        ctx.fillStyle = "#000";
        ctx.font = "bold " + fontSize + "px sans-serif";
        
        ctx.clearRect(0, 0, this._stw, this._sth);

        var lyricsObj = this.lyricsObj;
        var lyricsArr = this.lyricsArr;

        var len = lyricsArr.length;

        var startX = 0, startY = 0, // 文字の描画位置
            numX = size, numY = size, // グリッド数
            offX = 0, offY = 0; // オフセット [px]

        if (this._sth < this._stw)
        {
            numX   = Math.floor(this._stw / blockSize) + 2;
            offX   = - (this._stw % blockSize) / 2;
            startX = Math.floor((numX - size) / 2);
        }
        else
        {
            numY   = Math.floor(this._sth / blockSize) + 2;
            offX   = - (this._sth % blockSize) / 2;
            startY = Math.floor((numY - size) / 2);
        }

        var randomNum = Math.round(len/8);

        // 文字のモザイク描画
        for (var y = 0; y < numY; y ++)
        {
            for (var x = 0; x < numX; x ++)
            {
                var n = 0;
                
                if (tx && lyricsObj[tx] && startX <= x && x < startX + size && startY <= y && y < startY + size)
                {
                    var dn = (y - startY) * size + (x - startX);
                    var alp = lyricsObj[tx].data[dn];
                    n = Math.floor((alp / lyricsObj[tx].max) * (len - 1));
                }
                var numFront = Math.min(n, randomNum);
                var numBack  = Math.min(len - 1 - n, randomNum);
                n += Math.round(Math.random() * (numFront + numBack) - numFront);

                var text = lyricsArr[n].text;
                var px = x * blockSize + blockSize / 2 + offX;
                var py = y * blockSize + blockSize / 2 + offY + fontSize * 0.37;

                ctx.fillText(text, px, py);
            }
        }
    }
}

new Main()