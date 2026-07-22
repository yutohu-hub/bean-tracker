"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import * as d3 from "d3";

/* ============================================================
   BEAN TRACKER — プロトタイプ v0.1
   グリッド図鑑 / ロースターページ(NOW・SOLD OUT・ARCHIVE)
   実データの代わりにサンプルデータで手触りを確認するための試作
   ============================================================ */

const INK = "#17150F";
const PAPER = "#FAFAF7";
const GRAY = "#8A857B";
const LINE = "#E4E1D8";
const GREEN = "#2F5233";
const AMBER = "#A87B2E";

const ROASTERS = {
  bibi: { name: "bibi", city: "東京 / 亀戸", country: "JP", platform: "STORES", note: "下町のファントムロースター", coord: [139.83, 35.7],
    founded: "2024", style: "浅〜中煎り・少量焙煎", ship: "国内発送(2〜3日)", focus: "エチオピア・中南米",
    bio: "東京・亀戸の下町で少量ずつ焙煎するファントムロースター。店舗を持たず、映像と写真で豆の背景を伝えながら、日々の一杯に寄り添う豆を届けている。" },
  tw: { name: "Tim Wendelboe", city: "Oslo", country: "NO", platform: "Shopify", note: "北欧浅煎りの原点", coord: [10.75, 59.91], url: "timwendelboe.no",
    founded: "2007", style: "極浅煎り・北欧スタイル", ship: "海外発送(1〜2週間)", focus: "ケニア・コロンビア",
    bio: "2004年ワールド・バリスタ・チャンピオンのティム・ウェンデルボーが、オスロに構えた焙煎所兼エスプレッソバー。素材の風味を最大限に残す極浅煎りで「北欧スタイル」を世界に広めた存在。コロンビアに自身の農園を持つほど、生産の現場にも踏み込んでいる。" },
  onyx: { name: "Onyx Coffee Lab", city: "Arkansas", country: "US", platform: "Shopify", note: "デザインと透明性の名店", coord: [-94.12, 36.33], url: "onyxcoffeelab.com",
    founded: "2012", style: "浅〜中煎り・実験的精製", ship: "海外発送(1〜2週間)", focus: "エチオピア・中南米",
    bio: "アーカンソー州で夫妻が創業。生産者への支払額まで公開する徹底した透明性と、グラフィカルなパッケージデザインで知られる。実験的な精製の豆を積極的に扱い、アメリカのスペシャルティシーンを牽引する一軒。" },
  cc: { name: "Coffee Collective", city: "København", country: "DK", platform: "Shopify", note: "ダイレクトトレードの先駆", coord: [12.57, 55.68], url: "coffeecollective.dk",
    founded: "2007", style: "浅煎り・ダイレクトトレード", ship: "海外発送(1〜2週間)", focus: "ケニア・エチオピア",
    bio: "コペンハーゲンで創業。相場を大きく上回る対価を生産者に直接支払うダイレクトトレードをいち早く実践し、その取引価格を公開してきた。デンマークのコーヒー文化を象徴するロースター。" },
  april: { name: "April Coffee", city: "København", country: "DK", platform: "Shopify", note: "焙煎を突き詰める探究者", coord: [12.55, 55.67], url: "aprilcoffeeroasters.com",
    founded: "2018", style: "浅煎り・精密焙煎", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "パトリック・ローデンバーグがコペンハーゲンで立ち上げた焙煎所。「焙煎の進歩」を掲げ、一杯ごとの再現性とレシピの透明性を徹底追求する。カヨンマウンテンやビクトル・バレラら生産者との継続的な関係を軸に、澄んだ甘さの浅煎りを届ける。" },
  glitch: { name: "GLITCH COFFEE", city: "東京 / 神田", country: "JP", platform: "Shopify", note: "都心の極浅シングルオリジン", coord: [139.76, 35.69], url: "shop.glitchcoffee.com",
    founded: "2015", style: "極浅煎り・シングルオリジン", ship: "国内発送(2〜4日)", focus: "エチオピア・ゲイシャ",
    bio: "鈴木清和が神田錦町に開いた焙煎所兼ハンドドリップ専門店。Qグレーダーの目で選び抜いた最上級ロットを、素材の輪郭が際立つ極浅で焼く。ゲイシャなど希少品種を惜しみなく並べ、東京の浅煎りシーンを象徴する一軒。" },
  sey: { name: "Sey Coffee", city: "Brooklyn", country: "US", platform: "Shopify", note: "生産者名で選ぶ透明性", coord: [-73.93, 40.71], url: "seycoffee.com",
    founded: "2016", style: "極浅煎り・シングルロット", ship: "海外発送(1〜2週間)", focus: "エチオピア・ケニア",
    bio: "ブルックリン・ブッシュウィックの焙煎所。ロットごとに生産者・農園・精製を明記する徹底した透明性と、風味を最大限に引き出す極浅焙煎で知られる。季節ごとに世界の銘品を入れ替える、NYスペシャルティの旗手。" },
  barn: { name: "The Barn", city: "Berlin", country: "DE", platform: "Shopify", note: "欧州を牽引する老舗", coord: [13.40, 52.52], url: "thebarn.de",
    founded: "2010", style: "浅〜中浅煎り・季節替わり", ship: "海外発送(1〜2週間)", focus: "ケニア・エチオピア",
    bio: "ベルリンで創業し、ヨーロッパのスペシャルティを牽引してきた焙煎所。ケニアやエチオピアの果実味あふれるロットを中心に、ゲイシャ・ヴィレッジなどの希少豆も扱う。品質基準の高さで欧州各地のカフェから信頼を集める。" },
  pm: { name: "Proud Mary", city: "Melbourne", country: "AU", platform: "Shopify", note: "豪州の華やかロースター", coord: [144.96, -37.81], url: "proudmarycoffee.com.au",
    founded: "2009", style: "浅〜中浅煎り・果実系", ship: "海外発送(1〜2週間)", focus: "コロンビア・エチオピア",
    bio: "メルボルンを拠点に、鮮やかな果実味とエネルギッシュな味づくりで知られるオーストラリアの人気ロースター。COE入賞ロットやコロンビアのゲイシャ・シドラなど、攻めた希少品種のラインナップにも定評がある。" },
  lacabra: { name: "La Cabra", city: "Aarhus", country: "DK", platform: "Shopify", note: "透明感を極める北欧派", coord: [10.20, 56.16], url: "lacabra.com",
    founded: "2012", style: "極浅煎り・北欧スタイル", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "デンマーク・オーフス発。花や果実の輪郭を澄んだまま引き出す極浅焙煎で世界的な支持を集め、ニューヨークにも展開。生産地との継続的な関係を軸に、シーズンごとに銘品を入れ替える。" },
  manhattan: { name: "Manhattan Coffee", city: "Rotterdam", country: "NL", platform: "Shopify", note: "蘭の実験派デュオ", coord: [4.48, 51.92], url: "manhattancoffeeroasters.com",
    founded: "2017", style: "浅煎り・華やか系", ship: "海外発送(1〜2週間)", focus: "エチオピア・ゲイシャ",
    bio: "エスター・マースダムとベン・モロウがロッテルダムで立ち上げた焙煎所。華やかで甘さの際立つ浅煎りと、ゲイシャなど希少ロットの目利きで知られ、欧州のスペシャルティ好きから厚い支持を得ている。" },
  fuglen: { name: "Fuglen Coffee", city: "Oslo", country: "NO", platform: "Shopify", note: "北欧×東京の橋渡し", coord: [10.73, 59.92], url: "fuglencoffee.no",
    founded: "2014", style: "浅煎り・北欧スタイル", ship: "海外発送(1〜2週間)", focus: "エチオピア・ケニア",
    bio: "オスロと東京にまたがるコーヒー＆カクテルの名店。北欧らしい澄んだ浅煎りを軸に、両都市のカルチャーを結ぶ存在として親しまれている。日本のシーンにも縁の深いロースター。" },
  kurasu: { name: "Kurasu", city: "京都", country: "JP", platform: "Shopify", note: "京都発・世界へ届ける", coord: [135.77, 35.00], url: "kurasu.kyoto",
    founded: "2016", style: "浅〜中浅煎り・季節替わり", ship: "国内発送(2〜4日)", focus: "エチオピア・コロンビア",
    bio: "京都を拠点に、器具からコーヒーまでを世界へ届けるロースター＆ショップ。飲みやすく澄んだ浅〜中浅を軸に、季節ごとに世界の生産地からロットを迎える。国内からも手に取りやすい一軒。" },
  sqmile: { name: "Square Mile", city: "London", country: "GB", platform: "Shopify", note: "英国王道の名門", coord: [-0.06, 51.53], url: "squaremilecoffee.com",
    founded: "2008", style: "浅〜中浅煎り・王道", ship: "海外発送(1〜2週間)", focus: "ケニア・エチオピア",
    bio: "2007年ワールド・バリスタ・チャンピオンのジェームズ・ホフマンとアネッテ・モルドヴァがロンドン東部に構えた名門。看板ブレンド Red Brick と、産地の個性を素直に映すシングルオリジンで英国スペシャルティの基準を作ってきた。" },
  gardelli: { name: "Gardelli", city: "Forlì", country: "IT", platform: "Shopify", note: "伊のマイクロロースター", coord: [12.04, 44.22], url: "gardellicoffee.com",
    founded: "2010", style: "浅煎り・コンペティション級", ship: "海外発送(1〜2週間)", focus: "ゲイシャ・希少ロット",
    bio: "2017年ワールド・コーヒー・ロースティング・チャンピオンのルーベンス・ガルデッリが率いる、イタリア屈指のマイクロロースター。パナマやコロンビアの最高級ゲイシャを中心に、香りの設計に振り切ったロットで世界の愛好家を唸らせる。" },
  onibus: { name: "Onibus Coffee", city: "東京 / 中目黒", country: "JP", platform: "Shopify", note: "産地と直につながる", coord: [139.70, 35.64], url: "onibuscoffee.com",
    founded: "2012", style: "浅〜中浅煎り・直接取引", ship: "国内発送(2〜4日)", focus: "ケニア・エチオピア",
    bio: "坂尾篤史が中目黒で始めた焙煎所兼カフェ。生産者との直接的な関係とトレーサビリティを軸に、少量ずつ丁寧に焼く。明るい酸のケニアやエチオピアが看板で、東京の日常に根づいたロースター。" },
  ona: { name: "ONA Coffee", city: "Canberra", country: "AU", platform: "Shopify", note: "豪州の競技王者", coord: [149.13, -35.28], url: "onacoffee.com.au",
    founded: "2009", style: "浅〜中浅煎り・競技志向", ship: "海外発送(1〜2週間)", focus: "ゲイシャ・コロンビア",
    bio: "サーサ・セスティックを擁し、数々のバリスタ／ブリューワーズ選手権を制してきたオーストラリアの強豪。ゲイシャやシドラなど希少品種の目利きと、緻密な精製へのこだわりで知られる。" },

  koppi: { name: "Koppi", city: "Helsingborg", country: "SE", platform: "Shopify", note: "北欧の重鎮", coord: [12.69, 56.05], url: "koppi.se",
    founded: "2007", style: "極浅煎り・北欧スタイル", ship: "海外発送(1〜2週間)", focus: "エチオピア・ケニア",
    bio: "スウェーデン王者夫妻アンネ・ルネル＆シャルル・ニーストランドが率いる北欧の名門。生産者との長い関係を軸に、澄んだ果実味の極浅を焼く。" },
  drop: { name: "Drop Coffee", city: "Stockholm", country: "SE", platform: "Shopify", note: "ストックホルムの実力派", coord: [18.07, 59.33], url: "dropcoffee.com",
    founded: "2009", style: "極浅煎り・北欧スタイル", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "ストックホルム発。透明感とトレーサビリティを重んじる北欧スタイルの代表格で、世界大会でも活躍してきた。" },
  morgon: { name: "Morgon Coffee", city: "Göteborg", country: "SE", platform: "Shopify", note: "西スウェーデンの新鋭", coord: [11.97, 57.71],
    founded: "2016", style: "極浅煎り・北欧スタイル", ship: "海外発送(1〜2週間)", focus: "エチオピア・ケニア",
    bio: "ヨーテボリの焙煎所。シーズンごとに厳選したロットを、素材の輪郭を残す極浅で届ける。" },
  prolog: { name: "Prolog Coffee", city: "København", country: "DK", platform: "Shopify", note: "コペンハーゲンの精鋭", coord: [12.59, 55.67], url: "prologcoffee.com",
    founded: "2016", style: "浅煎り・季節替わり", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "約30の生産者と直接取引するコペンハーゲンのロースター。ベリー・ナッツ・シトラスが映える軽やかな焙煎で知られる。" },
  friedhats: { name: "Friedhats", city: "Amsterdam", country: "NL", platform: "Shopify", note: "蘭の極浅ロースター", coord: [4.89, 52.37], url: "friedhats.com",
    founded: "2016", style: "極浅煎り・北欧寄り", ship: "海外発送(1〜2週間)", focus: "エチオピア・ケニア",
    bio: "アムステルダムの焙煎所。クリーンで果実味の際立つ極浅を軸に、欧州の愛好家から支持を集める。" },
  dak: { name: "DAK Coffee", city: "Amsterdam", country: "NL", platform: "Shopify", note: "実験と遊び心", coord: [4.9, 52.36], url: "dakcoffeeroasters.com",
    founded: "2018", style: "浅煎り・実験系", ship: "海外発送(1〜2週間)", focus: "ゲイシャ・エチオピア",
    bio: "モントリオール出身のデュオがアムステルダムで創業。ファンキーな実験ロットから王道まで、遊び心ある選定で人気。" },
  bonanza: { name: "Bonanza Coffee", city: "Berlin", country: "DE", platform: "Shopify", note: "欧州の先駆者", coord: [13.42, 52.5], url: "bonanzacoffee.de",
    founded: "2006", style: "浅〜中浅煎り", ship: "海外発送(1〜2週間)", focus: "ゲイシャ・エチオピア",
    bio: "2006年からベルリンで欧州スペシャルティを牽引。ゲイシャのエスプレッソなど希少ロットの品揃えでも知られる。" },
  fiveele: { name: "Five Elephant", city: "Berlin", country: "DE", platform: "Shopify", note: "産地に通う名店", coord: [13.42, 52.49], url: "fiveelephant.com",
    founded: "2010", style: "浅煎り・直接取引", ship: "海外発送(1〜2週間)", focus: "エチオピア・グアテマラ",
    bio: "ベルリンの名店。自らが産地に足を運び、フェアな対価で仕入れる姿勢と、澄んだエチオピアで高い評価を得る。" },
  nomad: { name: "Nomad Coffee", city: "Barcelona", country: "ES", platform: "Shopify", note: "バルセロナの旗手", coord: [2.17, 41.39], url: "nomadcoffee.es",
    founded: "2014", style: "浅煎り・季節替わり", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "ロンドンの移動カートから始まり、2014年にバルセロナへ。スペインのスペシャルティを象徴する軽やかな浅煎り。" },
  assembly: { name: "Assembly Coffee", city: "London", country: "GB", platform: "Shopify", note: "ブリクストンの実力派", coord: [-0.11, 51.46], url: "assemblycoffee.co.uk",
    founded: "2015", style: "浅煎り・受賞多数", ship: "海外発送(1〜2週間)", focus: "エチオピア・希少ロット",
    bio: "ロンドン・ブリクストンの独立系。長時間アナエロビックのエチオピアなど、攻めたロットと受賞歴で知られる。" },
  colonna: { name: "Colonna Coffee", city: "Bath", country: "GB", platform: "Shopify", note: "探究のカフェ", coord: [-2.36, 51.38], url: "colonnacoffee.com",
    founded: "2009", style: "浅煎り・探究志向", ship: "海外発送(1〜2週間)", focus: "エチオピア・ケニア",
    bio: "バース発。『欧州ベストカフェ』にも輝いた探究型で、固定のハウス豆を置かず常に入れ替わる構成が特徴。" },
  roundhill: { name: "Round Hill Roastery", city: "Somerset", country: "GB", platform: "Shopify", note: "英南西部の実直派", coord: [-2.3, 51.3], url: "roundhillroastery.com",
    founded: "2013", style: "中浅煎り・実直", ship: "海外発送(1〜2週間)", focus: "ブラジル・エチオピア",
    bio: "サマセットの田園で焼く英国のロースター。飲みやすさと素材感を両立させた実直な一杯で親しまれる。" },
  howell: { name: "George Howell", city: "Acton", country: "US", platform: "Shopify", note: "米の父", coord: [-71.43, 42.48], url: "georgehowellcoffee.com",
    founded: "2004", style: "中浅煎り・単一農園", ship: "海外発送(1〜2週間)", focus: "エチオピア・ケニア",
    bio: "スペシャルティの父ジョージ・ハウエルが率いるボストンの名門。単一農園の銘品を精緻に焼き上げる。" },
  heart: { name: "Heart Coffee", city: "Portland", country: "US", platform: "Shopify", note: "ポートランドの透明感", coord: [-122.65, 45.52], url: "heartroasters.com",
    founded: "2009", style: "浅煎り・クリーン", ship: "海外発送(1〜2週間)", focus: "エチオピア・ケニア",
    bio: "フィンランド出身ウィレが創業。カラメル感より透明感を優先し、ポートランドの明るい浅煎りを定義した。" },
  coava: { name: "Coava Coffee", city: "Portland", country: "US", platform: "Shopify", note: "単一産地一筋", coord: [-122.66, 45.51], url: "coavacoffee.com",
    founded: "2008", style: "浅〜中浅煎り・単一産地", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "ポートランドのシングルオリジン専門。ドリップ／エスプレッソで焙煎profileを変え、産地の個性を素直に映す。" },
  passenger: { name: "Passenger Coffee", city: "Lancaster", country: "US", platform: "Shopify", note: "広大なメニュー", coord: [-76.31, 40.04], url: "drinkpassenger.com",
    founded: "2013", style: "浅煎り・多彩", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "ペンシルベニア・ランカスター発。常時30種超という広大なラインナップと軽やかな焙煎で全米の評価を集める。" },
  bw: { name: "Black & White", city: "Raleigh", country: "US", platform: "Shopify", note: "王者バリスタ二人", coord: [-78.64, 35.78], url: "blackwhiteroasters.com",
    founded: "2017", style: "浅〜中浅煎り", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "全米チャンピオンのカイル＆レムが創業したノースカロライナの焙煎所。切れのある果実味とブレンド設計に定評。" },
  verve: { name: "Verve Coffee", city: "Santa Cruz", country: "US", platform: "Shopify", note: "西海岸の顔", coord: [-122.03, 36.97], url: "vervecoffee.com",
    founded: "2007", style: "中浅煎り・バランス", ship: "海外発送(1〜2週間)", focus: "コロンビア・エチオピア",
    bio: "サンタクルーズ発、西海岸を象徴するロースター。デザインとカフェ文化、持続可能な調達で広く親しまれる。" },
  prodigal: { name: "Prodigal Coffee", city: "Boulder", country: "US", platform: "Shopify", note: "スコット・ラオの探究", coord: [-105.27, 40.01], url: "getprodigal.com",
    founded: "2021", style: "極浅煎り・高精度", ship: "海外発送(1〜2週間)", focus: "コロンビア・エチオピア",
    bio: "スコット・ラオらがボルダーで立ち上げた予約制ロースター。徹底した品質管理と果実味の設計で知られる。" },
  ruby: { name: "Ruby Coffee", city: "Nelsonville", country: "US", platform: "Shopify", note: "中西部の宝石", coord: [-89.3, 44.47], url: "rubycoffeeroasters.com",
    founded: "2013", style: "浅煎り・繊細", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "ウィスコンシンの小規模焙煎所。繊細で甘さの伸びる浅煎りが評価され、中西部スペシャルティの代表格。" },
  stumptown: { name: "Stumptown", city: "Portland", country: "US", platform: "Shopify", note: "第三の波の象徴", coord: [-122.66, 45.52], url: "stumptowncoffee.com",
    founded: "1999", style: "中煎り・王道", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "ポートランド発、サードウェーブを象徴する老舗。看板ブレンド Hair Bender は世界的に知られる。" },
  philseb: { name: "Phil & Sebastian", city: "Calgary", country: "CA", platform: "Shopify", note: "カナダ西部の名門", coord: [-114.07, 51.05], url: "philsebastian.com",
    founded: "2007", style: "浅〜中浅煎り・直接取引", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "カルガリー発。中南米やアフリカの生産者と直接取引し、精緻な焙煎で高品質を追求するカナダの名門。" },
  p49: { name: "49th Parallel", city: "Vancouver", country: "CA", platform: "Shopify", note: "BCの実力派", coord: [-122.98, 49.25], url: "49thcoffee.com",
    founded: "2004", style: "中浅煎り・直接取引", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "ブリティッシュコロンビア発。世界各地の農家と直接つながり、幅広い産地の銘品を扱うカナダの主要ロースター。" },
  marketlane: { name: "Market Lane", city: "Melbourne", country: "AU", platform: "Shopify", note: "メルボルンの定番", coord: [144.96, -37.81], url: "marketlane.com.au",
    founded: "2009", style: "浅〜中浅煎り・季節替わり", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "メルボルンを代表するロースター＆リテーラー。旬に合わせて少量ずつ焼き、素材の良さを引き出す。" },
  smallbatch: { name: "Small Batch", city: "Melbourne", country: "AU", platform: "Shopify", note: "卸の雄", coord: [144.95, -37.8], url: "smallbatch.com.au",
    founded: "2005", style: "中浅煎り・少量焙煎", ship: "海外発送(1〜2週間)", focus: "ブレンド・エチオピア",
    bio: "ノース・メルボルンの少量焙煎所。人気ブレンド Candyman などでメルボルンの卸シーンを支える存在。" },
  axil: { name: "Axil Coffee", city: "Melbourne", country: "AU", platform: "Shopify", note: "競技志向の名店", coord: [145.03, -37.82], url: "axilcoffee.com.au",
    founded: "2011", style: "浅〜中浅煎り・競技志向", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "メルボルンの競技志向ロースター。バリスタ大会での実績を背景に、明るく整った果実味の一杯を届ける。" },
  supreme: { name: "Coffee Supreme", city: "Wellington", country: "NZ", platform: "Shopify", note: "NZの草分け", coord: [174.78, -41.29], url: "coffeesupreme.com",
    founded: "1993", style: "中浅煎り・季節替わり", ship: "海外発送(1〜2週間)", focus: "ルワンダ・エチオピア",
    bio: "1993年ウェリントン創業、ニュージーランドのスペシャルティ草分け。エスプレッソからシングルオリジンまで幅広い。" },
  flight: { name: "Flight Coffee", city: "Wellington", country: "NZ", platform: "Shopify", note: "産地志向の新鋭", coord: [174.77, -41.29], url: "flightcoffee.co.nz",
    founded: "2011", style: "浅〜中浅煎り・産地志向", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "ウェリントンの産地志向ロースター。生産者との関係を軸に、明るくクリーンなカップを追求する。" },
  philo: { name: "Philocoffea", city: "船橋 / 千葉", country: "JP", platform: "Shopify", note: "世界王者の設計", coord: [139.98, 35.69], url: "philocoffea.com",
    founded: "2016", style: "浅煎り・ブレンド設計", ship: "国内発送(2〜4日)", focus: "エチオピア・コロンビア",
    bio: "World Brewers Cup王者・粕谷哲が率いる千葉・船橋の焙煎所。抽出まで見据えた設計と、Tokyo Blend などで知られる。" },
  leaves: { name: "Leaves Coffee", city: "東京 / 両国", country: "JP", platform: "Shopify", note: "甘さと香りの追求", coord: [139.79, 35.69], url: "leavescoffee.jp",
    founded: "2017", style: "浅煎り・甘さ重視", ship: "国内発送(2〜4日)", focus: "エチオピア・ケニア",
    bio: "東京・両国の焙煎所。甘さと香りに振り切った浅煎りで、焙煎競技でも上位に食い込む石井康雄が率いる。" },
  lightup: { name: "Light Up Coffee", city: "東京 / 吉祥寺", country: "JP", platform: "Shopify", note: "軽やかな明るさ", coord: [139.58, 35.7], url: "lightupcoffee.com",
    founded: "2014", style: "浅煎り・クリーン", ship: "国内発送(2〜4日)", focus: "エチオピア・グアテマラ",
    bio: "東京・吉祥寺発。明るくクリーンな浅煎りで、コーヒーの果実感を身近に伝えるロースター。" },
  county: { name: "Coffee County", city: "福岡", country: "JP", platform: "Shopify", note: "九州の名店", coord: [130.4, 33.59], url: "coffeecounty.cc",
    founded: "2013", style: "中浅煎り・中米志向", ship: "国内発送(2〜4日)", focus: "エチオピア・グアテマラ",
    bio: "福岡のロースター。中米・アフリカの銘品を軸に、飲み心地の良い明るい焙煎で九州のシーンを牽引する。" },
  nylon: { name: "Nylon Coffee", city: "Singapore", country: "SG", platform: "Shopify", note: "シンガポールの象徴", coord: [103.84, 1.28], url: "nyloncoffee.sg",
    founded: "2012", style: "浅煎り・直接取引", ship: "海外発送(1〜2週間)", focus: "ルワンダ・コロンビア",
    bio: "シンガポール・エバートンパークの焙煎所。生産者との持続的な関係を軸に、東南アジアのスペシャルティを象徴する。" },

  standout: { name: "Standout Coffee", city: "Stockholm", country: "SE", platform: "Shopify", note: "ゲイシャの名店", coord: [18.07, 59.33], url: "standoutcoffee.com",
    founded: "2019", style: "極浅煎り・希少ロット", ship: "海外発送(1〜2週間)", focus: "ゲイシャ・希少ロット",
    bio: "ストックホルム発。世界の突出したロットだけを選び、90か国以上へ届ける超高級路線のロースター。" },
  damatteo: { name: "da Matteo", city: "Göteborg", country: "SE", platform: "Shopify", note: "エチオピアの名店", coord: [11.97, 57.71], url: "damatteo.se",
    founded: "2005", style: "浅〜中浅煎り・季節替わり", ship: "海外発送(1〜2週間)", focus: "エチオピア・ケニア",
    bio: "ヨーテボリの中心で焙煎・ベーカリー・カフェを営むスウェーデンの名店。競技にも出る実力派。" },
  johannystrom: { name: "Johan & Nyström", city: "Stockholm", country: "SE", platform: "Shopify", note: "エチオピアの名店", coord: [18.06, 59.34], url: "johanochnystrom.se",
    founded: "2004", style: "浅〜中煎り・北欧", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "スウェーデンのスペシャルティを黎明期から牽引。透明感のある焙煎で北欧の食卓に根づく。" },
  solberghansen: { name: "Solberg & Hansen", city: "Oslo", country: "NO", platform: "Shopify", note: "エチオピアの名店", coord: [10.75, 59.92], url: "sh.no",
    founded: "1879", style: "浅〜中煎り・老舗", ship: "海外発送(1〜2週間)", focus: "エチオピア・ケニア",
    bio: "1879年創業、ノルウェー最大級の老舗焙煎所。世界中の農家から高品質豆を直接仕入れる。" },
  talorjorgen: { name: "Talor & Jørgen", city: "Oslo", country: "NO", platform: "Shopify", note: "エチオピアの名店", coord: [10.74, 59.92], url: "talorjorgen.com",
    founded: "2015", style: "浅煎り・北欧スタイル", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "オスロの焙煎所兼ベーカリー。澄んだ北欧スタイルの浅煎りと菓子で親しまれる。" },
  andersenmaillard: { name: "Andersen & Maillard", city: "København", country: "DK", platform: "Shopify", note: "エチオピアの名店", coord: [12.55, 55.69], url: "andersenmaillard.dk",
    founded: "2018", style: "浅煎り・現地焙煎", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "コペンハーゲン・ノアブロの焙煎所兼ベーカリー。元Nomaの菓子と澄んだ浅煎りで人気。" },
  lot61: { name: "LOT61 Coffee", city: "Amsterdam", country: "NL", platform: "Shopify", note: "エチオピアの名店", coord: [4.87, 52.37], url: "lot61.com",
    founded: "2013", style: "浅〜中浅煎り", ship: "海外発送(1〜2週間)", focus: "エチオピア・ブラジル",
    bio: "アムステルダムの人気焙煎所。豪州＆NYのコーヒー文化を背景に、キンカーストラートで焙煎する。" },
  bocca: { name: "Bocca Coffee", city: "Amsterdam", country: "NL", platform: "Shopify", note: "エチオピアの名店", coord: [4.9, 52.37], url: "bocca.nl",
    founded: "2001", style: "浅〜中浅煎り・直接取引", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "オランダのスペシャルティ草分け。生産者との直接取引を早くから実践してきた老舗。" },
  manvsmachine: { name: "Man Versus Machine", city: "München", country: "DE", platform: "Shopify", note: "エチオピアの名店", coord: [11.57, 48.13], url: "mvsm.coffee",
    founded: "2014", style: "浅煎り・独立系", ship: "海外発送(1〜2週間)", focus: "エチオピア・ケニア",
    bio: "ミュンヘンの独立系ロースター。明るくクリーンな焙煎でドイツ南部のシーンを牽引する。" },
  elbgold: { name: "Elbgold", city: "Hamburg", country: "DE", platform: "Shopify", note: "エチオピアの名店", coord: [9.99, 53.55], url: "elbgold.com",
    founded: "2007", style: "中浅煎り・季節替わり", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "ハンブルクの焙煎所兼カフェ。ドイツ北部を代表するスペシャルティの担い手。" },
  grams: { name: "Nineteen Grams", city: "Berlin", country: "DE", platform: "Shopify", note: "エチオピアの名店", coord: [13.43, 52.51], url: "19grams.coffee",
    founded: "2013", style: "浅煎り・季節替わり", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "ベルリンの焙煎所。世界各地の旬のロットを軽やかに焼き上げる。" },
  rightside: { name: "Right Side Coffee", city: "Barcelona", country: "ES", platform: "Shopify", note: "ゲイシャの名店", coord: [2.16, 41.4], url: "rightsidecoffee.com",
    founded: "2015", style: "浅煎り・受賞多数", ship: "海外発送(1〜2週間)", focus: "ゲイシャ・エチオピア",
    bio: "バルセロナ発の受賞歴あるロースター。華やかなゲイシャや高品質ロットで知られる。" },
  hola: { name: "Hola Coffee", city: "Madrid", country: "ES", platform: "Shopify", note: "エチオピアの名店", coord: [-3.7, 40.41], url: "holacoffee.es",
    founded: "2016", style: "浅煎り・クリーン", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "マドリードのスペシャルティを象徴する焙煎所兼カフェ。明るくクリーンな一杯を届ける。" },
  elmagnifico: { name: "Cafés El Magnífico", city: "Barcelona", country: "ES", platform: "Shopify", note: "エチオピアの名店", coord: [2.18, 41.38], url: "cafeselmagnifico.com",
    founded: "1919", style: "中浅煎り・老舗", ship: "海外発送(1〜2週間)", focus: "エチオピア・グアテマラ",
    bio: "バルセロナ旧市街の老舗。長い歴史の中でスペシャルティへ舵を切った、街の顔的ロースター。" },
  workshop: { name: "Workshop Coffee", city: "London", country: "GB", platform: "Shopify", note: "エチオピアの名店", coord: [-0.14, 51.52], url: "workshopcoffee.com",
    founded: "2011", style: "浅〜中浅煎り・季節替わり", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "ロンドンの実力派。ベスナルグリーンで焼く季節替わりのシングルオリジンとブレンドで評価が高い。" },
  origincoffee: { name: "Origin Coffee", city: "Cornwall", country: "GB", platform: "Shopify", note: "エチオピアの名店", coord: [-5.27, 50.1], url: "origincoffee.co.uk",
    founded: "2004", style: "浅〜中浅煎り・直接取引", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "英コーンウォール発、ロンドンにも展開。産地との関係を軸にした英国スペシャルティの草分け。" },
  caravan: { name: "Caravan Coffee", city: "London", country: "GB", platform: "Shopify", note: "エチオピアの名店", coord: [-0.11, 51.53], url: "caravancoffeeroasters.co.uk",
    founded: "2010", style: "中浅煎り・季節替わり", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "エクスマウス・マーケットで創業。焙煎とオールデイダイニングでロンドンに定着した人気店。" },
  ozone: { name: "Ozone Coffee", city: "London", country: "GB", platform: "Shopify", note: "エチオピアの名店", coord: [-0.08, 51.53], url: "ozonecoffee.co.uk",
    founded: "1998", style: "中浅煎り・直接取引", ship: "海外発送(1〜2週間)", focus: "エチオピア・ケニア",
    bio: "ニュージーランド発、ロンドンにアンティポディアンのカフェ文化を持ち込んだ焙煎所。" },
  kissthehippo: { name: "Kiss the Hippo", city: "London", country: "GB", platform: "Shopify", note: "エチオピアの名店", coord: [-0.3, 51.46], url: "kissthehippo.com",
    founded: "2018", style: "浅煎り・サステナブル", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "ロンドン・リッチモンド発。カーボンニュートラルを掲げる、革新的でサステナブルなロースター。" },
  intelligentsia: { name: "Intelligentsia", city: "Chicago", country: "US", platform: "Shopify", note: "エチオピアの名店", coord: [-87.68, 41.91], url: "intelligentsia.com",
    founded: "1995", style: "中浅煎り・直接取引", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "シカゴ発、米スペシャルティの先駆。ダイレクトトレードを広めた業界の巨人。" },
  counterculture: { name: "Counter Culture", city: "Durham", country: "US", platform: "Shopify", note: "エチオピアの名店", coord: [-78.9, 35.99], url: "counterculturecoffee.com",
    founded: "1995", style: "中浅煎り・教育志向", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "ノースカロライナ発。透明性と教育に力を入れる、米東海岸を代表するロースター。" },
  bluebottle: { name: "Blue Bottle", city: "Oakland", country: "US", platform: "Shopify", note: "エチオピアの名店", coord: [-122.27, 37.8], url: "bluebottlecoffee.com",
    founded: "2002", style: "中浅煎り・鮮度重視", ship: "海外発送(1〜2週間)", focus: "エチオピア・ブレンド",
    bio: "オークランド発、サードウェーブを象徴するブランド。鮮度への徹底したこだわりで知られる。" },
  sightglass: { name: "Sightglass", city: "San Francisco", country: "US", platform: "Shopify", note: "エチオピアの名店", coord: [-122.41, 37.77], url: "sightglasscoffee.com",
    founded: "2009", style: "中浅煎り・小ロット", ship: "海外発送(1〜2週間)", focus: "エチオピア・ブレンド",
    bio: "サンフランシスコの兄弟が営む焙煎所。丁寧な小ロット焙煎とデザインで人気。" },
  wreckingball: { name: "Wrecking Ball", city: "San Francisco", country: "US", platform: "Shopify", note: "エチオピアの名店", coord: [-122.43, 37.79], url: "wreckingballcoffee.com",
    founded: "2014", style: "浅〜中浅煎り", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "SFの実力派夫妻ロースター。明るくクリーンなカップで根強い支持を集める。" },
  equator: { name: "Equator Coffees", city: "San Rafael", country: "US", platform: "Shopify", note: "エチオピアの名店", coord: [-122.53, 37.97], url: "equatorcoffees.com",
    founded: "1995", style: "中浅煎り・サステナブル", ship: "海外発送(1〜2週間)", focus: "エチオピア・ブレンド",
    bio: "サンフランシスコ湾岸発。フェアで持続可能な調達を掲げるベイエリアの名門。" },
  sweetbloom: { name: "Sweet Bloom", city: "Lakewood", country: "US", platform: "Shopify", note: "エチオピアの名店", coord: [-105.08, 39.7], url: "sweetbloomcoffee.com",
    founded: "2014", style: "浅煎り・鮮度重視", ship: "海外発送(1〜2週間)", focus: "エチオピア・ブレンド",
    bio: "コロラドの焙煎所。焼きたての甘さとクリーンさに焦点を当てた一杯で高評価。" },
  corvus: { name: "Corvus Coffee", city: "Denver", country: "US", platform: "Shopify", note: "コロンビアの名店", coord: [-104.99, 39.68], url: "corvuscoffee.com",
    founded: "2010", style: "浅〜中浅煎り・希少ロット", ship: "海外発送(1〜2週間)", focus: "コロンビア・希少品種",
    bio: "デンバーの焙煎所。シドラなど希少品種にも積極的な、クラフト志向のロースター。" },
  methodical: { name: "Methodical Coffee", city: "Greenville", country: "US", platform: "Shopify", note: "エチオピアの名店", coord: [-82.4, 34.85], url: "methodicalcoffee.com",
    founded: "2015", style: "浅〜中浅煎り", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "サウスカロライナ・グリーンヴィルの焙煎所。丁寧な設計と洗練で南部シーンを牽引。" },
  tandem: { name: "Tandem Coffee", city: "Portland ME", country: "US", platform: "Shopify", note: "エチオピアの名店", coord: [-70.28, 43.66], url: "tandemcoffee.com",
    founded: "2012", style: "中浅煎り・季節替わり", ship: "海外発送(1〜2週間)", focus: "エチオピア・ブレンド",
    bio: "メイン州ポートランドの焙煎所兼ベーカリー。飲みやすく親しみやすい一杯で愛される。" },
  madcap: { name: "Madcap Coffee", city: "Grand Rapids", country: "US", platform: "Shopify", note: "エチオピアの名店", coord: [-85.67, 42.96], url: "madcapcoffee.com",
    founded: "2008", style: "浅〜中浅煎り", ship: "海外発送(1〜2週間)", focus: "エチオピア・ブレンド",
    bio: "ミシガン・グランドラピッズ発。中西部を代表する、精緻で明るいロースター。" },
  temple: { name: "Temple Coffee", city: "Sacramento", country: "US", platform: "Shopify", note: "エチオピアの名店", coord: [-121.49, 38.58], url: "templecoffee.com",
    founded: "2005", style: "中浅煎り・季節替わり", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "サクラメントの焙煎所。多店舗を構えつつ質の高いシングルオリジンを揃える。" },
  camber: { name: "Camber Coffee", city: "Bellingham", country: "US", platform: "Shopify", note: "エチオピアの名店", coord: [-122.48, 48.75], url: "cambercoffee.com",
    founded: "2016", style: "浅煎り・北欧寄り", ship: "海外発送(1〜2週間)", focus: "エチオピア・ケニア",
    bio: "ワシントン州ベリンガムの焙煎所。北欧寄りの澄んだ浅煎りで注目を集める。" },
  pilot: { name: "Pilot Coffee", city: "Toronto", country: "CA", platform: "Shopify", note: "エチオピアの名店", coord: [-79.35, 43.66], url: "pilotcoffeeroasters.com",
    founded: "2009", style: "中浅煎り・直接取引", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "トロントを代表する焙煎所。直接取引と品質管理でカナダ東部のシーンを牽引する。" },
  rosso: { name: "Rosso Coffee", city: "Calgary", country: "CA", platform: "Shopify", note: "コスタリカの名店", coord: [-114.06, 51.05], url: "rossocoffeeroasters.com",
    founded: "2008", style: "中浅煎り・小ロット", ship: "海外発送(1〜2週間)", focus: "コスタリカ・エチオピア",
    bio: "カルガリーの焙煎所。少量ずつ丁寧に焼く、カナダ西部のクラフトロースター。" },
  singleo: { name: "Single O", city: "Sydney", country: "AU", platform: "Shopify", note: "エチオピアの名店", coord: [151.21, -33.88], url: "singleo.com.au",
    founded: "2003", style: "中浅煎り・直接取引", ship: "海外発送(1〜2週間)", focus: "エチオピア・ブレンド",
    bio: "シドニー・サリーヒルズ発。倫理的な調達と技術志向で知られる豪州の人気ロースター。" },
  sevenseeds: { name: "Seven Seeds", city: "Melbourne", country: "AU", platform: "Shopify", note: "エチオピアの名店", coord: [144.96, -37.8], url: "sevenseeds.com.au",
    founded: "2007", style: "中浅煎り・季節替わり", ship: "海外発送(1〜2週間)", focus: "エチオピア・ブレンド",
    bio: "メルボルンの中核的ロースター。カールトンの旗艦店を軸に季節のシングルオリジンを届ける。" },
  padre: { name: "Padre Coffee", city: "Melbourne", country: "AU", platform: "Shopify", note: "エチオピアの名店", coord: [144.99, -37.83], url: "padrecoffee.com.au",
    founded: "2008", style: "中浅煎り・果実系", ship: "海外発送(1〜2週間)", focus: "エチオピア・ブレンド",
    bio: "メルボルンとヌーサに展開。豊かな果実味とブレンド設計で親しまれる焙煎所。" },
  mecca: { name: "Mecca Coffee", city: "Sydney", country: "AU", platform: "Shopify", note: "エチオピアの名店", coord: [151.19, -33.9], url: "mecca.coffee",
    founded: "2005", style: "中浅煎り・パイオニア", ship: "海外発送(1〜2週間)", focus: "エチオピア・ブレンド",
    bio: "2005年創業、シドニーのスペシャルティ草分け。安定した品質で長く支持される。" },
  allpress: { name: "Allpress Espresso", city: "Auckland", country: "NZ", platform: "Shopify", note: "エチオピアの名店", coord: [174.76, -36.85], url: "allpressespresso.com",
    founded: "1989", style: "中煎り・エスプレッソ", ship: "海外発送(1〜2週間)", focus: "エチオピア・ブレンド",
    bio: "オークランド発、豪州・英・日にも展開するアンティポディアンの名門エスプレッソロースター。" },
  arabica: { name: "% Arabica", city: "京都", country: "JP", platform: "Shopify", note: "ゲイシャの名店", coord: [135.77, 35], url: "arabica.com",
    founded: "2013", style: "浅〜中浅煎り・世界展開", ship: "国内発送(2〜4日)", focus: "ゲイシャ・エチオピア",
    bio: "京都発、世界中に店を構えるブランド。シンプルな設計と%ブレンド、希少ゲイシャで知られる。" },
  maruyama: { name: "丸山珈琲", city: "軽井沢", country: "JP", platform: "Shopify", note: "ゲイシャの名店", coord: [138.6, 36.34], url: "maruyamacoffee.com",
    founded: "1991", style: "中浅煎り・COE志向", ship: "国内発送(2〜4日)", focus: "ゲイシャ・エチオピア",
    bio: "軽井沢発、日本のスペシャルティを牽引してきた名門。COE審査員も務め、希少ロットに強い。" },
  switch: { name: "Switch Coffee", city: "東京", country: "JP", platform: "Shopify", note: "エチオピアの名店", coord: [139.68, 35.64], url: "switchcoffeetokyo.com",
    founded: "2013", style: "浅〜中浅煎り", ship: "国内発送(2〜4日)", focus: "エチオピア・コロンビア",
    bio: "東京・目黒発の小さな焙煎所。澄んだシングルオリジンで着実にファンを増やしてきた。" },
  woodberry: { name: "Woodberry Coffee", city: "東京", country: "JP", platform: "Shopify", note: "エチオピアの名店", coord: [139.6, 35.63], url: "woodberrycoffee.com",
    founded: "2015", style: "浅〜中浅煎り", ship: "国内発送(2〜4日)", focus: "エチオピア・コロンビア",
    bio: "東京・桜新町発。丁寧な焙煎と品質で評価を高める、若い世代の人気ロースター。" },
  rec: { name: "Rec Coffee", city: "福岡", country: "JP", platform: "Shopify", note: "エチオピアの名店", coord: [130.4, 33.58], url: "rec-coffee.com",
    founded: "2008", style: "中浅煎り・競技志向", ship: "国内発送(2〜4日)", focus: "エチオピア・グアテマラ",
    bio: "福岡発、バリスタ競技での実績を持つ焙煎所。飲み心地の良い明るい一杯で九州を代表する。" },
  trunk: { name: "Trunk Coffee", city: "名古屋", country: "JP", platform: "Shopify", note: "エチオピアの名店", coord: [136.91, 35.17], url: "trunkcoffee.com",
    founded: "2014", style: "浅〜中浅煎り・北欧寄り", ship: "国内発送(2〜4日)", focus: "エチオピア・コロンビア",
    bio: "名古屋の焙煎所兼カフェ。北欧の影響を受けた洗練された浅煎りで中部シーンを牽引。" },
  nozy: { name: "Nozy Coffee", city: "東京", country: "JP", platform: "Shopify", note: "エチオピアの名店", coord: [139.7, 35.66], url: "nozycoffee.jp",
    founded: "2010", style: "浅〜中浅煎り・単一産地", ship: "国内発送(2〜4日)", focus: "エチオピア・ブラジル",
    bio: "東京・三宿発。シングルオリジンにこだわり、The Roasteryなども手がける焙煎所。" },
  horiguchi: { name: "堀口珈琲", city: "東京", country: "JP", platform: "Shopify", note: "エチオピアの名店", coord: [139.63, 35.61], url: "horiguchicoffee.com",
    founded: "1990", style: "中〜中深煎り・老舗", ship: "国内発送(2〜4日)", focus: "エチオピア・グアテマラ",
    bio: "日本のスペシャルティを黎明期から支えてきた名門。深みと甘さのある焙煎に定評がある。" },
  threemarks: { name: "Three Marks Coffee", city: "Barcelona", country: "ES", platform: "Shopify", note: "エチオピアの名店", coord: [2.15, 41.39], url: "threemarkscoffee.com",
    founded: "2017", style: "浅煎り・季節替わり", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "バルセロナの新鋭ロースター。旬のロットを軽やかに焼き、スペインの若手シーンを担う。" },
  rocketbean: { name: "Rocket Bean Roastery", city: "Riga", country: "LV", platform: "Shopify", note: "エチオピアの名店", coord: [24.12, 56.95], url: "rocketbean.eu",
    founded: "2014", style: "浅〜中浅煎り", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "ラトビア・リガの焙煎所兼カフェ。バルト地域のスペシャルティを象徴する存在。" },
  ppp: { name: "PPP Coffee", city: "Singapore", country: "SG", platform: "Shopify", note: "エチオピアの名店", coord: [103.85, 1.28], url: "pppcoffee.com",
    founded: "2009", style: "浅〜中浅煎り・直接取引", ship: "海外発送(1〜2週間)", focus: "エチオピア・ブレンド",
    bio: "旧Papa Palheta。シンガポールのスペシャルティを牽引してきた、調達から焙煎まで手がける名門。" },
  supremerw: { name: "Supreme Roastworks", city: "Oslo", country: "NO", platform: "Shopify", note: "エチオピアの名店", coord: [10.74, 59.91], url: "srw.no",
    founded: "2013", style: "浅煎り・北欧スタイル", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "Osloを拠点とするノルウェーのスペシャルティロースター。エチオピア・コロンビアを軸に、澄んだ北欧スタイルの浅煎りで知られる。" },
  kaffaoslo: { name: "Kaffa", city: "Oslo", country: "NO", platform: "Shopify", note: "エチオピアの名店", coord: [10.74, 59.91], url: "kaffa.no",
    founded: "1994", style: "浅煎り・北欧スタイル", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "Osloを拠点とするノルウェーのスペシャルティロースター。エチオピア・コロンビアを軸に、澄んだ北欧スタイルの浅煎りで知られる。" },
  kaffebrenneriet: { name: "Kaffebrenneriet", city: "Oslo", country: "NO", platform: "Shopify", note: "エチオピアの名店", coord: [10.74, 59.91], url: "kaffebrenneriet.no",
    founded: "1994", style: "浅煎り・北欧スタイル", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "Osloを拠点とするノルウェーのスペシャルティロースター。エチオピア・コロンビアを軸に、澄んだ北欧スタイルの浅煎りで知られる。" },
  jacu: { name: "Jacu Coffee Roastery", city: "Ålesund", country: "NO", platform: "Shopify", note: "エチオピアの名店", coord: [6.15, 62.47], url: "jacu.no",
    founded: "2011", style: "浅煎り・北欧スタイル", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "Ålesundを拠点とするノルウェーのスペシャルティロースター。エチオピア・コロンビアを軸に、澄んだ北欧スタイルの浅煎りで知られる。" },
  langora: { name: "Langøra Kaffe", city: "Stjørdal", country: "NO", platform: "Shopify", note: "エチオピアの名店", coord: [10.92, 63.47], url: "langorakaffe.no",
    founded: "2016", style: "浅煎り・北欧スタイル", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "Stjørdalを拠点とするノルウェーのスペシャルティロースター。エチオピア・コロンビアを軸に、澄んだ北欧スタイルの浅煎りで知られる。" },
  talormade: { name: "Talormade", city: "Oslo", country: "NO", platform: "Shopify", note: "エチオピアの名店", coord: [10.74, 59.91], url: "talormade.no",
    founded: "2013", style: "浅煎り・北欧スタイル", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "Osloを拠点とするノルウェーのスペシャルティロースター。エチオピア・コロンビアを軸に、澄んだ北欧スタイルの浅煎りで知られる。" },
  lippe: { name: "Lippe", city: "Oslo", country: "NO", platform: "Shopify", note: "エチオピアの名店", coord: [10.74, 59.91], url: "lippe.no",
    founded: "2016", style: "浅煎り・北欧スタイル", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "Osloを拠点とするノルウェーのスペシャルティロースター。エチオピア・コロンビアを軸に、澄んだ北欧スタイルの浅煎りで知られる。" },
  kaffemisjonen: { name: "Kaffemisjonen", city: "Bergen", country: "NO", platform: "Shopify", note: "エチオピアの名店", coord: [5.32, 60.39], url: "kaffemisjonen.no",
    founded: "2007", style: "浅煎り・北欧スタイル", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "Bergenを拠点とするノルウェーのスペシャルティロースター。エチオピア・コロンビアを軸に、澄んだ北欧スタイルの浅煎りで知られる。" },
  detlille: { name: "Det Lille Kaffekompani", city: "Bergen", country: "NO", platform: "Shopify", note: "エチオピアの名店", coord: [5.32, 60.39], url: "dlk.no",
    founded: "2000", style: "浅煎り・北欧スタイル", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "Bergenを拠点とするノルウェーのスペシャルティロースター。エチオピア・コロンビアを軸に、澄んだ北欧スタイルの浅煎りで知られる。" },
  jacobsensvart: { name: "Jacobsen & Svart", city: "Trondheim", country: "NO", platform: "Shopify", note: "エチオピアの名店", coord: [10.4, 63.43], url: "jacobsenogsvart.no",
    founded: "2015", style: "浅煎り・北欧スタイル", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "Trondheimを拠点とするノルウェーのスペシャルティロースター。エチオピア・コロンビアを軸に、澄んだ北欧スタイルの浅煎りで知られる。" },
  boenner: { name: "Bønner i Byen", city: "Oslo", country: "NO", platform: "Shopify", note: "エチオピアの名店", coord: [10.74, 59.91],
    founded: "—", style: "浅煎り・北欧スタイル", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "Osloを拠点とするノルウェーのスペシャルティロースター。エチオピア・コロンビアを軸に、澄んだ北欧スタイルの浅煎りで知られる。" },
  java: { name: "Java Espressobar", city: "Oslo", country: "NO", platform: "Shopify", note: "エチオピアの名店", coord: [10.74, 59.91], url: "javamocca.no",
    founded: "1997", style: "浅煎り・北欧スタイル", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "Osloを拠点とするノルウェーのスペシャルティロースター。エチオピア・コロンビアを軸に、澄んだ北欧スタイルの浅煎りで知られる。" },
  lykke: { name: "Lykke Kaffegårdar", city: "Stockholm", country: "SE", platform: "Shopify", note: "エチオピアの名店", coord: [18.07, 59.33], url: "lykkegardar.se",
    founded: "—", style: "浅煎り・北欧スタイル", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "Stockholmを拠点とするスウェーデンのスペシャルティロースター。エチオピア・コロンビアを軸に、澄んだ北欧スタイルの浅煎りで知られる。" },
  solde: { name: "Solde Kafferosteri", city: "Malmö", country: "SE", platform: "Shopify", note: "エチオピアの名店", coord: [13, 55.6], url: "solde.se",
    founded: "2010", style: "浅煎り・北欧スタイル", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "Malmöを拠点とするスウェーデンのスペシャルティロースター。エチオピア・コロンビアを軸に、澄んだ北欧スタイルの浅煎りで知られる。" },
  gringo: { name: "Gringo Nordic", city: "Göteborg", country: "SE", platform: "Shopify", note: "エチオピアの名店", coord: [11.97, 57.71], url: "gringonordic.com",
    founded: "—", style: "浅煎り・北欧スタイル", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "Göteborgを拠点とするスウェーデンのスペシャルティロースター。エチオピア・コロンビアを軸に、澄んだ北欧スタイルの浅煎りで知られる。" },
  kafferaven: { name: "Kafferäven", city: "Göteborg", country: "SE", platform: "Shopify", note: "エチオピアの名店", coord: [11.97, 57.71], url: "kafferaven.se",
    founded: "2013", style: "浅煎り・北欧スタイル", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "Göteborgを拠点とするスウェーデンのスペシャルティロースター。エチオピア・コロンビアを軸に、澄んだ北欧スタイルの浅煎りで知られる。" },
  stockholmroast: { name: "Stockholm Roast", city: "Stockholm", country: "SE", platform: "Shopify", note: "エチオピアの名店", coord: [18.07, 59.33], url: "stockholmroast.se",
    founded: "—", style: "浅煎り・北欧スタイル", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "Stockholmを拠点とするスウェーデンのスペシャルティロースター。エチオピア・コロンビアを軸に、澄んだ北欧スタイルの浅煎りで知られる。" },
  kaffelabbet: { name: "Kaffelabbet", city: "Stockholm", country: "SE", platform: "Shopify", note: "エチオピアの名店", coord: [18.07, 59.33], url: "kaffelabbet.se",
    founded: "—", style: "浅煎り・北欧スタイル", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "Stockholmを拠点とするスウェーデンのスペシャルティロースター。エチオピア・コロンビアを軸に、澄んだ北欧スタイルの浅煎りで知られる。" },
  kaffekaross: { name: "Kaffekaross", city: "Göteborg", country: "SE", platform: "Shopify", note: "エチオピアの名店", coord: [11.97, 57.71], url: "kaffekaross.se",
    founded: "—", style: "浅煎り・北欧スタイル", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "Göteborgを拠点とするスウェーデンのスペシャルティロースター。エチオピア・コロンビアを軸に、澄んだ北欧スタイルの浅煎りで知られる。" },
  animakaffe: { name: "Anima Kaffe", city: "Malmö", country: "SE", platform: "Shopify", note: "エチオピアの名店", coord: [13, 55.6],
    founded: "—", style: "浅煎り・北欧スタイル", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "Malmöを拠点とするスウェーデンのスペシャルティロースター。エチオピア・コロンビアを軸に、澄んだ北欧スタイルの浅煎りで知られる。" },
  kontra: { name: "Kontra Coffee", city: "København", country: "DK", platform: "Shopify", note: "エチオピアの名店", coord: [12.57, 55.68], url: "kontracoffee.com",
    founded: "2005", style: "浅煎り・北欧スタイル", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "Københavnを拠点とするデンマークのスペシャルティロースター。エチオピア・コロンビアを軸に、澄んだ北欧スタイルの浅煎りで知られる。" },
  greatcoffee: { name: "Great Coffee", city: "Aarhus", country: "DK", platform: "Shopify", note: "エチオピアの名店", coord: [10.2, 56.16], url: "greatcoffee.dk",
    founded: "2016", style: "浅煎り・北欧スタイル", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "Aarhusを拠点とするデンマークのスペシャルティロースター。エチオピア・コロンビアを軸に、澄んだ北欧スタイルの浅煎りで知られる。" },
  impact: { name: "Impact Roasters", city: "København", country: "DK", platform: "Shopify", note: "エチオピアの名店", coord: [12.57, 55.68], url: "impactroasters.dk",
    founded: "2015", style: "浅煎り・北欧スタイル", ship: "海外発送(1〜2週間)", focus: "エチオピア・シングルオリジン",
    bio: "Københavnを拠点とするデンマークのスペシャルティロースター。エチオピア・シングルオリジンを軸に、澄んだ北欧スタイルの浅煎りで知られる。" },
  democratic: { name: "Democratic Coffee", city: "København", country: "DK", platform: "Shopify", note: "エチオピアの名店", coord: [12.57, 55.68],
    founded: "—", style: "浅煎り・北欧スタイル", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "Københavnを拠点とするデンマークのスペシャルティロースター。エチオピア・コロンビアを軸に、澄んだ北欧スタイルの浅煎りで知られる。" },
  cphcoffeelab: { name: "Copenhagen Coffee Lab", city: "København", country: "DK", platform: "Shopify", note: "エチオピアの名店", coord: [12.57, 55.68], url: "copenhagencoffeelab.com",
    founded: "2013", style: "浅煎り・北欧スタイル", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "Københavnを拠点とするデンマークのスペシャルティロースター。エチオピア・コロンビアを軸に、澄んだ北欧スタイルの浅煎りで知られる。" },
  original: { name: "Original Coffee", city: "København", country: "DK", platform: "Shopify", note: "エチオピアの名店", coord: [12.57, 55.68], url: "originalcoffee.dk",
    founded: "2008", style: "浅煎り・北欧スタイル", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "Københavnを拠点とするデンマークのスペシャルティロースター。エチオピア・コロンビアを軸に、澄んだ北欧スタイルの浅煎りで知られる。" },
  risteriet: { name: "Risteriet Coffee", city: "København", country: "DK", platform: "Shopify", note: "エチオピアの名店", coord: [12.57, 55.68], url: "risteriet.dk",
    founded: "2007", style: "浅煎り・北欧スタイル", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "Københavnを拠点とするデンマークのスペシャルティロースター。エチオピア・コロンビアを軸に、澄んだ北欧スタイルの浅煎りで知られる。" },
  kaffa: { name: "Kaffa Roastery", city: "Helsinki", country: "FI", platform: "Shopify", note: "エチオピアの名店", coord: [24.94, 60.17], url: "kaffaroastery.fi",
    founded: "2007", style: "浅煎り・北欧スタイル", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "Helsinkiを拠点とするフィンランドのスペシャルティロースター。エチオピア・コロンビアを軸に、澄んだ北欧スタイルの浅煎りで知られる。" },
  goodlife: { name: "Good Life Coffee", city: "Helsinki", country: "FI", platform: "Shopify", note: "エチオピアの名店", coord: [24.94, 60.17], url: "goodlifecoffee.fi",
    founded: "2011", style: "浅煎り・北欧スタイル", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "Helsinkiを拠点とするフィンランドのスペシャルティロースター。エチオピア・コロンビアを軸に、澄んだ北欧スタイルの浅煎りで知られる。" },
  lehmus: { name: "Lehmus Roastery", city: "Lahti", country: "FI", platform: "Shopify", note: "エチオピアの名店", coord: [25.66, 60.98], url: "lehmusroastery.com",
    founded: "2015", style: "浅煎り・北欧スタイル", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "Lahtiを拠点とするフィンランドのスペシャルティロースター。エチオピア・コロンビアを軸に、澄んだ北欧スタイルの浅煎りで知られる。" },
  papu: { name: "Paahtimo Papu", city: "Porvoo", country: "FI", platform: "Shopify", note: "エチオピアの名店", coord: [25.66, 60.39], url: "papu.coffee",
    founded: "2014", style: "浅煎り・北欧スタイル", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "Porvooを拠点とするフィンランドのスペシャルティロースター。エチオピア・コロンビアを軸に、澄んだ北欧スタイルの浅煎りで知られる。" },
  turun: { name: "Turun Kahvipaahtimo", city: "Turku", country: "FI", platform: "Shopify", note: "エチオピアの名店", coord: [22.27, 60.45], url: "turunkahvipaahtimo.fi",
    founded: "2013", style: "浅煎り・北欧スタイル", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "Turkuを拠点とするフィンランドのスペシャルティロースター。エチオピア・コロンビアを軸に、澄んだ北欧スタイルの浅煎りで知られる。" },
  cafetoria: { name: "Cafetoria Roastery", city: "Lohja", country: "FI", platform: "Shopify", note: "エチオピアの名店", coord: [24.07, 60.25], url: "cafetoria.fi",
    founded: "2002", style: "浅煎り・北欧スタイル", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "Lohjaを拠点とするフィンランドのスペシャルティロースター。エチオピア・コロンビアを軸に、澄んだ北欧スタイルの浅煎りで知られる。" },
  helsinkiroastery: { name: "Helsinki Coffee Roastery", city: "Helsinki", country: "FI", platform: "Shopify", note: "エチオピアの名店", coord: [24.94, 60.17], url: "helsinginkahvipaahtimo.fi",
    founded: "2015", style: "浅煎り・北欧スタイル", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "Helsinkiを拠点とするフィンランドのスペシャルティロースター。エチオピア・コロンビアを軸に、澄んだ北欧スタイルの浅煎りで知られる。" },
  kahiwa: { name: "Kahiwa Coffee Roasters", city: "Helsinki", country: "FI", platform: "Shopify", note: "エチオピアの名店", coord: [24.94, 60.17], url: "kahiwacoffee.fi",
    founded: "—", style: "浅煎り・北欧スタイル", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "Helsinkiを拠点とするフィンランドのスペシャルティロースター。エチオピア・コロンビアを軸に、澄んだ北欧スタイルの浅煎りで知られる。" },
  mokkamestarit: { name: "Mokkamestarit", city: "Helsinki", country: "FI", platform: "Shopify", note: "エチオピアの名店", coord: [24.94, 60.17], url: "mokkamestarit.fi",
    founded: "—", style: "浅煎り・北欧スタイル", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "Helsinkiを拠点とするフィンランドのスペシャルティロースター。エチオピア・コロンビアを軸に、澄んだ北欧スタイルの浅煎りで知られる。" },
  record: { name: "Record Coffee", city: "Helsinki", country: "FI", platform: "Shopify", note: "エチオピアの名店", coord: [24.94, 60.17],
    founded: "—", style: "浅煎り・北欧スタイル", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "Helsinkiを拠点とするフィンランドのスペシャルティロースター。エチオピア・コロンビアを軸に、澄んだ北欧スタイルの浅煎りで知られる。" },
  reykjavik: { name: "Reykjavik Roasters", city: "Reykjavík", country: "IS", platform: "Shopify", note: "エチオピアの名店", coord: [-21.94, 64.15], url: "reykjavikroasters.is",
    founded: "2008", style: "浅煎り・北欧スタイル", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "Reykjavíkを拠点とするアイスランドのスペシャルティロースター。エチオピア・コロンビアを軸に、澄んだ北欧スタイルの浅煎りで知られる。" },
  kaffitar: { name: "Kaffitár", city: "Reykjavík", country: "IS", platform: "Shopify", note: "エチオピアの名店", coord: [-21.94, 64.15], url: "kaffitar.is",
    founded: "1990", style: "浅煎り・北欧スタイル", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "Reykjavíkを拠点とするアイスランドのスペシャルティロースター。エチオピア・コロンビアを軸に、澄んだ北欧スタイルの浅煎りで知られる。" },
  teogkaffi: { name: "Te & Kaffi", city: "Reykjavík", country: "IS", platform: "Shopify", note: "エチオピアの名店", coord: [-21.94, 64.15], url: "teogkaffi.is",
    founded: "1984", style: "浅煎り・北欧スタイル", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "Reykjavíkを拠点とするアイスランドのスペシャルティロースター。エチオピア・コロンビアを軸に、澄んだ北欧スタイルの浅煎りで知られる。" },
  kuma: { name: "Kuma Coffee", city: "Seattle", country: "US", platform: "Shopify", note: "エチオピアの名店", coord: [-122.33, 47.61], url: "kumacoffee.com",
    founded: "2010", style: "浅〜中浅煎り・季節替わり", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "Seattleを拠点とするアメリカのスペシャルティロースター。エチオピア・コロンビアを軸に、素材感を活かした浅〜中浅煎りで知られる。" },
  elm: { name: "Elm Coffee Roasters", city: "Seattle", country: "US", platform: "Shopify", note: "エチオピアの名店", coord: [-122.33, 47.61], url: "elmcoffeeroasters.com",
    founded: "2014", style: "浅〜中浅煎り・季節替わり", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "Seattleを拠点とするアメリカのスペシャルティロースター。エチオピア・コロンビアを軸に、素材感を活かした浅〜中浅煎りで知られる。" },
  herkimer: { name: "Herkimer Coffee", city: "Seattle", country: "US", platform: "Shopify", note: "エチオピアの名店", coord: [-122.33, 47.61], url: "herkimercoffee.com",
    founded: "2003", style: "浅〜中浅煎り・季節替わり", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "Seattleを拠点とするアメリカのスペシャルティロースター。エチオピア・コロンビアを軸に、素材感を活かした浅〜中浅煎りで知られる。" },
  victrola: { name: "Victrola Coffee", city: "Seattle", country: "US", platform: "Shopify", note: "エチオピアの名店", coord: [-122.33, 47.61], url: "victrolacoffee.com",
    founded: "2000", style: "浅〜中浅煎り・季節替わり", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "Seattleを拠点とするアメリカのスペシャルティロースター。エチオピア・コロンビアを軸に、素材感を活かした浅〜中浅煎りで知られる。" },
  dune: { name: "Dune Coffee", city: "Santa Barbara", country: "US", platform: "Shopify", note: "エチオピアの名店", coord: [-119.7, 34.42], url: "dunecoffee.com",
    founded: "2005", style: "浅〜中浅煎り・季節替わり", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "Santa Barbaraを拠点とするアメリカのスペシャルティロースター。エチオピア・コロンビアを軸に、素材感を活かした浅〜中浅煎りで知られる。" },
  portrait: { name: "Portrait Coffee", city: "Atlanta", country: "US", platform: "Shopify", note: "エチオピアの名店", coord: [-84.39, 33.75], url: "portrait.coffee",
    founded: "2020", style: "浅〜中浅煎り・季節替わり", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "Atlantaを拠点とするアメリカのスペシャルティロースター。エチオピア・コロンビアを軸に、素材感を活かした浅〜中浅煎りで知られる。" },
  littlewolf: { name: "Little Wolf Coffee", city: "Amherst", country: "US", platform: "Shopify", note: "エチオピアの名店", coord: [-72.52, 42.37], url: "littlewolfcoffee.com",
    founded: "2016", style: "浅〜中浅煎り・季節替わり", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "Amherstを拠点とするアメリカのスペシャルティロースター。エチオピア・コロンビアを軸に、素材感を活かした浅〜中浅煎りで知られる。" },
  broadsheet: { name: "Broadsheet Coffee", city: "Cambridge", country: "US", platform: "Shopify", note: "エチオピアの名店", coord: [-71.11, 42.37], url: "broadsheetcoffee.com",
    founded: "2017", style: "浅〜中浅煎り・季節替わり", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "Cambridgeを拠点とするアメリカのスペシャルティロースター。エチオピア・コロンビアを軸に、素材感を活かした浅〜中浅煎りで知られる。" },
  speedwell: { name: "Speedwell Coffee", city: "Boston", country: "US", platform: "Shopify", note: "エチオピアの名店", coord: [-71.06, 42.36], url: "speedwellcoffee.com",
    founded: "2014", style: "浅〜中浅煎り・季節替わり", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "Bostonを拠点とするアメリカのスペシャルティロースター。エチオピア・コロンビアを軸に、素材感を活かした浅〜中浅煎りで知られる。" },
  slate: { name: "Slate Coffee Roasters", city: "Seattle", country: "US", platform: "Shopify", note: "エチオピアの名店", coord: [-122.33, 47.61], url: "slatecoffee.com",
    founded: "2011", style: "浅〜中浅煎り・季節替わり", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "Seattleを拠点とするアメリカのスペシャルティロースター。エチオピア・コロンビアを軸に、素材感を活かした浅〜中浅煎りで知られる。" },
  demello: { name: "De Mello", city: "Toronto", country: "CA", platform: "Shopify", note: "エチオピアの名店", coord: [-79.38, 43.65], url: "demellopalheta.ca",
    founded: "2013", style: "浅〜中浅煎り・季節替わり", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "Torontoを拠点とするカナダのスペシャルティロースター。エチオピア・コロンビアを軸に、素材感を活かした浅〜中浅煎りで知られる。" },
  monogram: { name: "Monogram Coffee", city: "Calgary", country: "CA", platform: "Shopify", note: "エチオピアの名店", coord: [-114.07, 51.05], url: "monogramcoffee.com",
    founded: "2013", style: "浅〜中浅煎り・季節替わり", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "Calgaryを拠点とするカナダのスペシャルティロースター。エチオピア・コロンビアを軸に、素材感を活かした浅〜中浅煎りで知られる。" },
  subtext: { name: "Subtext Coffee", city: "Toronto", country: "CA", platform: "Shopify", note: "エチオピアの名店", coord: [-79.38, 43.65], url: "subtext.coffee",
    founded: "2017", style: "浅〜中浅煎り・季節替わり", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "Torontoを拠点とするカナダのスペシャルティロースター。エチオピア・コロンビアを軸に、素材感を活かした浅〜中浅煎りで知られる。" },
  extract: { name: "Extract Coffee", city: "Bristol", country: "GB", platform: "Shopify", note: "エチオピアの名店", coord: [-2.59, 51.45], url: "extractcoffee.co.uk",
    founded: "2007", style: "浅〜中浅煎り・季節替わり", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "Bristolを拠点とするイギリスのスペシャルティロースター。エチオピア・コロンビアを軸に、素材感を活かした浅〜中浅煎りで知られる。" },
  cliftoncoffee: { name: "Clifton Coffee", city: "Bristol", country: "GB", platform: "Shopify", note: "エチオピアの名店", coord: [-2.59, 51.45], url: "cliftoncoffee.co.uk",
    founded: "2010", style: "浅〜中浅煎り・季節替わり", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "Bristolを拠点とするイギリスのスペシャルティロースター。エチオピア・コロンビアを軸に、素材感を活かした浅〜中浅煎りで知られる。" },
  northstar: { name: "North Star Coffee", city: "Leeds", country: "GB", platform: "Shopify", note: "エチオピアの名店", coord: [-1.55, 53.8], url: "northstarroast.com",
    founded: "2013", style: "浅〜中浅煎り・季節替わり", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "Leedsを拠点とするイギリスのスペシャルティロースター。エチオピア・コロンビアを軸に、素材感を活かした浅〜中浅煎りで知られる。" },
  foundry: { name: "Foundry Coffee", city: "Sheffield", country: "GB", platform: "Shopify", note: "エチオピアの名店", coord: [-1.47, 53.38], url: "foundrycoffeeroasters.com",
    founded: "2013", style: "浅〜中浅煎り・季節替わり", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "Sheffieldを拠点とするイギリスのスペシャルティロースター。エチオピア・コロンビアを軸に、素材感を活かした浅〜中浅煎りで知られる。" },
  darkarts: { name: "Dark Arts Coffee", city: "London", country: "GB", platform: "Shopify", note: "エチオピアの名店", coord: [-0.12, 51.51], url: "darkartscoffee.co.uk",
    founded: "2014", style: "浅〜中浅煎り・季節替わり", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "Londonを拠点とするイギリスのスペシャルティロースター。エチオピア・コロンビアを軸に、素材感を活かした浅〜中浅煎りで知られる。" },
  girlswhogrind: { name: "Girls Who Grind", city: "Wiltshire", country: "GB", platform: "Shopify", note: "エチオピアの名店", coord: [0, 20], url: "girlswhogrindcoffee.com",
    founded: "2018", style: "浅〜中浅煎り・季節替わり", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "Wiltshireを拠点とするイギリスのスペシャルティロースター。エチオピア・コロンビアを軸に、素材感を活かした浅〜中浅煎りで知られる。" },
  mok: { name: "MOK Coffee", city: "Ghent", country: "BE", platform: "Shopify", note: "エチオピアの名店", coord: [3.72, 51.05], url: "mokcoffee.be",
    founded: "2013", style: "浅〜中浅煎り・季節替わり", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "Ghentを拠点とするベルギーのスペシャルティロースター。エチオピア・コロンビアを軸に、素材感を活かした浅〜中浅煎りで知られる。" },
  orcoffee: { name: "OR Coffee", city: "Ghent", country: "BE", platform: "Shopify", note: "エチオピアの名店", coord: [3.72, 51.05], url: "orcoffee.be",
    founded: "2003", style: "浅〜中浅煎り・季節替わり", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "Ghentを拠点とするベルギーのスペシャルティロースター。エチオピア・コロンビアを軸に、素材感を活かした浅〜中浅煎りで知られる。" },
  caffenation: { name: "Caffènation", city: "Antwerp", country: "BE", platform: "Shopify", note: "エチオピアの名店", coord: [4.4, 51.22], url: "caffenation.be",
    founded: "2000", style: "浅〜中浅煎り・季節替わり", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "Antwerpを拠点とするベルギーのスペシャルティロースター。エチオピア・コロンビアを軸に、素材感を活かした浅〜中浅煎りで知られる。" },
  coffeecircle: { name: "Coffee Circle", city: "Berlin", country: "DE", platform: "Shopify", note: "エチオピアの名店", coord: [13.4, 52.52], url: "coffeecircle.com",
    founded: "2010", style: "浅〜中浅煎り・季節替わり", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "Berlinを拠点とするドイツのスペシャルティロースター。エチオピア・コロンビアを軸に、素材感を活かした浅〜中浅煎りで知られる。" },
  roststatte: { name: "Röststätte", city: "Berlin", country: "DE", platform: "Shopify", note: "エチオピアの名店", coord: [13.4, 52.52], url: "roeststaette.com",
    founded: "2014", style: "浅〜中浅煎り・季節替わり", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "Berlinを拠点とするドイツのスペシャルティロースター。エチオピア・コロンビアを軸に、素材感を活かした浅〜中浅煎りで知られる。" },
  whitelabel: { name: "White Label Coffee", city: "Amsterdam", country: "NL", platform: "Shopify", note: "エチオピアの名店", coord: [4.89, 52.37], url: "whitelabelcoffee.nl",
    founded: "2015", style: "浅〜中浅煎り・季節替わり", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "Amsterdamを拠点とするオランダのスペシャルティロースター。エチオピア・コロンビアを軸に、素材感を活かした浅〜中浅煎りで知られる。" },
  keen: { name: "Keen Coffee", city: "Rotterdam", country: "NL", platform: "Shopify", note: "エチオピアの名店", coord: [4.48, 51.92], url: "keencoffee.nl",
    founded: "2015", style: "浅〜中浅煎り・季節替わり", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "Rotterdamを拠点とするオランダのスペシャルティロースター。エチオピア・コロンビアを軸に、素材感を活かした浅〜中浅煎りで知られる。" },
  industrybeans: { name: "Industry Beans", city: "Melbourne", country: "AU", platform: "Shopify", note: "エチオピアの名店", coord: [144.96, -37.81], url: "industrybeans.com",
    founded: "2013", style: "浅〜中浅煎り・季節替わり", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "Melbourneを拠点とするオーストラリアのスペシャルティロースター。エチオピア・コロンビアを軸に、素材感を活かした浅〜中浅煎りで知られる。" },
  codeblack: { name: "Code Black Coffee", city: "Melbourne", country: "AU", platform: "Shopify", note: "エチオピアの名店", coord: [144.96, -37.81], url: "codeblackcoffee.com.au",
    founded: "2011", style: "浅〜中浅煎り・季節替わり", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "Melbourneを拠点とするオーストラリアのスペシャルティロースター。エチオピア・コロンビアを軸に、素材感を活かした浅〜中浅煎りで知られる。" },
  dukes: { name: "Dukes Coffee", city: "Melbourne", country: "AU", platform: "Shopify", note: "エチオピアの名店", coord: [144.96, -37.81], url: "dukescoffee.com.au",
    founded: "2010", style: "浅〜中浅煎り・季節替わり", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "Melbourneを拠点とするオーストラリアのスペシャルティロースター。エチオピア・コロンビアを軸に、素材感を活かした浅〜中浅煎りで知られる。" },
  veneziano: { name: "Veneziano Coffee", city: "Melbourne", country: "AU", platform: "Shopify", note: "エチオピアの名店", coord: [144.96, -37.81], url: "venezianocoffee.com.au",
    founded: "1954", style: "浅〜中浅煎り・季節替わり", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "Melbourneを拠点とするオーストラリアのスペシャルティロースター。エチオピア・コロンビアを軸に、素材感を活かした浅〜中浅煎りで知られる。" },
  kokako: { name: "Kōkako", city: "Auckland", country: "NZ", platform: "Shopify", note: "エチオピアの名店", coord: [174.76, -36.85], url: "kokako.co.nz",
    founded: "2001", style: "浅〜中浅煎り・季節替わり", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "Aucklandを拠点とするニュージーランドのスペシャルティロースター。エチオピア・コロンビアを軸に、素材感を活かした浅〜中浅煎りで知られる。" },
  eighthirty: { name: "Eighthirty", city: "Auckland", country: "NZ", platform: "Shopify", note: "エチオピアの名店", coord: [174.76, -36.85], url: "eighthirty.com",
    founded: "2010", style: "浅〜中浅煎り・季節替わり", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "Aucklandを拠点とするニュージーランドのスペシャルティロースター。エチオピア・コロンビアを軸に、素材感を活かした浅〜中浅煎りで知られる。" },
  commonman: { name: "Common Man Coffee", city: "Singapore", country: "SG", platform: "Shopify", note: "エチオピアの名店", coord: [103.85, 1.29], url: "commonmancoffeeroasters.com",
    founded: "2013", style: "浅〜中浅煎り・季節替わり", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "Singaporeを拠点とするシンガポールのスペシャルティロースター。エチオピア・コロンビアを軸に、素材感を活かした浅〜中浅煎りで知られる。" },
  apartment: { name: "Apartment Coffee", city: "Singapore", country: "SG", platform: "Shopify", note: "エチオピアの名店", coord: [103.85, 1.29], url: "apartmentcoffee.sg",
    founded: "2019", style: "浅〜中浅煎り・季節替わり", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "Singaporeを拠点とするシンガポールのスペシャルティロースター。エチオピア・コロンビアを軸に、素材感を活かした浅〜中浅煎りで知られる。" },
  fritz: { name: "Fritz Coffee", city: "Seoul", country: "KR", platform: "Shopify", note: "エチオピアの名店", coord: [126.98, 37.57], url: "fritz.co.kr",
    founded: "2014", style: "浅〜中浅煎り・季節替わり", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "Seoulを拠点とする韓国のスペシャルティロースター。エチオピア・コロンビアを軸に、素材感を活かした浅〜中浅煎りで知られる。" },
  anthracite: { name: "Anthracite Coffee", city: "Seoul", country: "KR", platform: "Shopify", note: "エチオピアの名店", coord: [126.98, 37.57], url: "anthracitecoffee.com",
    founded: "2009", style: "浅〜中浅煎り・季節替わり", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "Seoulを拠点とする韓国のスペシャルティロースター。エチオピア・コロンビアを軸に、素材感を活かした浅〜中浅煎りで知られる。" },
  momos: { name: "Momos Coffee", city: "Busan", country: "KR", platform: "Shopify", note: "エチオピアの名店", coord: [129.08, 35.18], url: "momos.co.kr",
    founded: "2007", style: "浅〜中浅煎り・季節替わり", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "Busanを拠点とする韓国のスペシャルティロースター。エチオピア・コロンビアを軸に、素材感を活かした浅〜中浅煎りで知られる。" },
  coffeelibre: { name: "Coffee Libre", city: "Seoul", country: "KR", platform: "Shopify", note: "エチオピアの名店", coord: [126.98, 37.57], url: "coffeelibre.kr",
    founded: "2009", style: "浅〜中浅煎り・季節替わり", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "Seoulを拠点とする韓国のスペシャルティロースター。エチオピア・コロンビアを軸に、素材感を活かした浅〜中浅煎りで知られる。" },
  center: { name: "Center Coffee", city: "Seoul", country: "KR", platform: "Shopify", note: "エチオピアの名店", coord: [126.98, 37.57], url: "centercoffee.co.kr",
    founded: "2016", style: "浅〜中浅煎り・季節替わり", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "Seoulを拠点とする韓国のスペシャルティロースター。エチオピア・コロンビアを軸に、素材感を活かした浅〜中浅煎りで知られる。" },
  coffeeacademics: { name: "The Coffee Academics", city: "Hong Kong", country: "HK", platform: "Shopify", note: "ゲイシャの名店", coord: [114.17, 22.28], url: "the-coffeeacademics.com",
    founded: "2012", style: "浅〜中浅煎り・季節替わり", ship: "海外発送(1〜2週間)", focus: "ゲイシャ・シングルオリジン",
    bio: "Hong Kongを拠点とする香港のスペシャルティロースター。ゲイシャ・シングルオリジンを軸に、素材感を活かした浅〜中浅煎りで知られる。" },
  cuppingroom: { name: "The Cupping Room", city: "Hong Kong", country: "HK", platform: "Shopify", note: "エチオピアの名店", coord: [114.17, 22.28], url: "cuppingroom.hk",
    founded: "2011", style: "浅〜中浅煎り・季節替わり", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "Hong Kongを拠点とする香港のスペシャルティロースター。エチオピア・コロンビアを軸に、素材感を活かした浅〜中浅煎りで知られる。" },
  roots: { name: "Roots Coffee", city: "Bangkok", country: "TH", platform: "Shopify", note: "エチオピアの名店", coord: [100.5, 13.76], url: "rootsbkk.com",
    founded: "2013", style: "浅〜中浅煎り・季節替わり", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "Bangkokを拠点とするタイのスペシャルティロースター。エチオピア・コロンビアを軸に、素材感を活かした浅〜中浅煎りで知られる。" },
  roast: { name: "Roast Coffee", city: "Bangkok", country: "TH", platform: "Shopify", note: "エチオピアの名店", coord: [100.5, 13.76], url: "roastcoffeeandeatery.com",
    founded: "2012", style: "浅〜中浅煎り・季節替わり", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "Bangkokを拠点とするタイのスペシャルティロースター。エチオピア・コロンビアを軸に、素材感を活かした浅〜中浅煎りで知られる。" },
  mameya: { name: "Koffee Mameya", city: "東京", country: "JP", platform: "Shopify", note: "エチオピアの名店", coord: [139.7, 35.66], url: "koffee-mameya.com",
    founded: "2017", style: "浅〜中浅煎り・季節替わり", ship: "国内発送(2〜4日)", focus: "エチオピア・コロンビア",
    bio: "東京を拠点とする日本のスペシャルティロースター。エチオピア・コロンビアを軸に、素材感を活かした浅〜中浅煎りで知られる。" },
  passage: { name: "Passage Coffee", city: "東京", country: "JP", platform: "Shopify", note: "エチオピアの名店", coord: [139.7, 35.66], url: "passagecoffee.com",
    founded: "2016", style: "浅〜中浅煎り・季節替わり", ship: "国内発送(2〜4日)", focus: "エチオピア・コロンビア",
    bio: "東京を拠点とする日本のスペシャルティロースター。エチオピア・コロンビアを軸に、素材感を活かした浅〜中浅煎りで知られる。" },
  unlimited: { name: "Unlimited Coffee", city: "東京", country: "JP", platform: "Shopify", note: "エチオピアの名店", coord: [139.7, 35.66], url: "unlimitedcoffeeroasters.com",
    founded: "2015", style: "浅〜中浅煎り・季節替わり", ship: "国内発送(2〜4日)", focus: "エチオピア・コロンビア",
    bio: "東京を拠点とする日本のスペシャルティロースター。エチオピア・コロンビアを軸に、素材感を活かした浅〜中浅煎りで知られる。" },
  bearpond: { name: "Bear Pond Espresso", city: "東京", country: "JP", platform: "Shopify", note: "エチオピアの名店", coord: [139.7, 35.66], url: "bear-pond.com",
    founded: "2009", style: "浅〜中浅煎り・季節替わり", ship: "国内発送(2〜4日)", focus: "エチオピア・コロンビア",
    bio: "東京を拠点とする日本のスペシャルティロースター。エチオピア・コロンビアを軸に、素材感を活かした浅〜中浅煎りで知られる。" },
  aboutlife: { name: "About Life Coffee", city: "東京", country: "JP", platform: "Shopify", note: "エチオピアの名店", coord: [139.7, 35.66],
    founded: "—", style: "浅〜中浅煎り・季節替わり", ship: "国内発送(2〜4日)", focus: "エチオピア・コロンビア",
    bio: "東京を拠点とする日本のスペシャルティロースター。エチオピア・コロンビアを軸に、素材感を活かした浅〜中浅煎りで知られる。" },
  coffeewrights: { name: "Coffee Wrights", city: "東京", country: "JP", platform: "Shopify", note: "エチオピアの名店", coord: [139.7, 35.66], url: "coffee-wrights.jp",
    founded: "2016", style: "浅〜中浅煎り・季節替わり", ship: "国内発送(2〜4日)", focus: "エチオピア・コロンビア",
    bio: "東京を拠点とする日本のスペシャルティロースター。エチオピア・コロンビアを軸に、素材感を活かした焙煎で知られる。" },
  amameria: { name: "Amameria Espresso", city: "東京", country: "JP", platform: "Shopify", note: "エチオピアの名店", coord: [139.7, 35.66], url: "amameria.com",
    founded: "2012", style: "浅〜中浅煎り・季節替わり", ship: "国内発送(2〜4日)", focus: "エチオピア・コロンビア",
    bio: "東京を拠点とする日本のスペシャルティロースター。エチオピア・コロンビアを軸に、素材感を活かした焙煎で知られる。" },
  saza: { name: "Saza Coffee", city: "ひたちなか", country: "JP", platform: "Shopify", note: "エチオピアの名店", coord: [140.53, 36.39], url: "saza.co.jp",
    founded: "1969", style: "浅〜中浅煎り・季節替わり", ship: "国内発送(2〜4日)", focus: "エチオピア・コロンビア",
    bio: "ひたちなかを拠点とする日本のスペシャルティロースター。エチオピア・コロンビアを軸に、素材感を活かした焙煎で知られる。" },
  sarutahiko: { name: "Sarutahiko Coffee", city: "東京", country: "JP", platform: "Shopify", note: "エチオピアの名店", coord: [139.7, 35.66], url: "sarutahiko.co",
    founded: "2011", style: "浅〜中浅煎り・季節替わり", ship: "国内発送(2〜4日)", focus: "エチオピア・コロンビア",
    bio: "東京を拠点とする日本のスペシャルティロースター。エチオピア・コロンビアを軸に、素材感を活かした焙煎で知られる。" },
  yanaka: { name: "Yanaka Coffee", city: "東京", country: "JP", platform: "Shopify", note: "エチオピアの名店", coord: [139.7, 35.66], url: "yanaka-coffeeten.com",
    founded: "1994", style: "浅〜中浅煎り・季節替わり", ship: "国内発送(2〜4日)", focus: "エチオピア・コロンビア",
    bio: "東京を拠点とする日本のスペシャルティロースター。エチオピア・コロンビアを軸に、素材感を活かした焙煎で知られる。" },
  streamer: { name: "Streamer Coffee", city: "東京", country: "JP", platform: "Shopify", note: "エチオピアの名店", coord: [139.7, 35.66], url: "streamer.coffee",
    founded: "2008", style: "浅〜中浅煎り・季節替わり", ship: "国内発送(2〜4日)", focus: "エチオピア・コロンビア",
    bio: "東京を拠点とする日本のスペシャルティロースター。エチオピア・コロンビアを軸に、素材感を活かした焙煎で知られる。" },
  obscura: { name: "Obscura Coffee", city: "東京", country: "JP", platform: "Shopify", note: "エチオピアの名店", coord: [139.7, 35.66], url: "obscura-coffee.com",
    founded: "2009", style: "浅〜中浅煎り・季節替わり", ship: "国内発送(2〜4日)", focus: "エチオピア・コロンビア",
    bio: "東京を拠点とする日本のスペシャルティロースター。エチオピア・コロンビアを軸に、素材感を活かした焙煎で知られる。" },
  mel: { name: "Mel Coffee Roasters", city: "大阪", country: "JP", platform: "Shopify", note: "エチオピアの名店", coord: [135.5, 34.69], url: "melcoffee.stores.jp",
    founded: "2014", style: "浅〜中浅煎り・季節替わり", ship: "国内発送(2〜4日)", focus: "エチオピア・コロンビア",
    bio: "大阪を拠点とする日本のスペシャルティロースター。エチオピア・コロンビアを軸に、素材感を活かした焙煎で知られる。" },
  takamura: { name: "Takamura Coffee", city: "大阪", country: "JP", platform: "Shopify", note: "エチオピアの名店", coord: [135.5, 34.69], url: "takamuranet.com",
    founded: "—", style: "浅〜中浅煎り・季節替わり", ship: "国内発送(2〜4日)", focus: "エチオピア・コロンビア",
    bio: "大阪を拠点とする日本のスペシャルティロースター。エチオピア・コロンビアを軸に、素材感を活かした焙煎で知られる。" },
  lilo: { name: "LiLo Coffee Roasters", city: "大阪", country: "JP", platform: "Shopify", note: "エチオピアの名店", coord: [135.5, 34.69], url: "lilocoffee.jp",
    founded: "2015", style: "浅〜中浅煎り・季節替わり", ship: "国内発送(2〜4日)", focus: "エチオピア・コロンビア",
    bio: "大阪を拠点とする日本のスペシャルティロースター。エチオピア・コロンビアを軸に、素材感を活かした焙煎で知られる。" },
  ogawa: { name: "Ogawa Coffee", city: "京都", country: "JP", platform: "Shopify", note: "エチオピアの名店", coord: [135.77, 35], url: "oc-ogawa.co.jp",
    founded: "1952", style: "浅〜中浅煎り・季節替わり", ship: "国内発送(2〜4日)", focus: "エチオピア・コロンビア",
    bio: "京都を拠点とする日本のスペシャルティロースター。エチオピア・コロンビアを軸に、素材感を活かした焙煎で知られる。" },
  weekenders: { name: "Weekenders Coffee", city: "京都", country: "JP", platform: "Shopify", note: "エチオピアの名店", coord: [135.77, 35], url: "weekenderscoffee.com",
    founded: "2005", style: "浅〜中浅煎り・季節替わり", ship: "国内発送(2〜4日)", focus: "エチオピア・コロンビア",
    bio: "京都を拠点とする日本のスペシャルティロースター。エチオピア・コロンビアを軸に、素材感を活かした焙煎で知られる。" },
  manu: { name: "Manu Coffee", city: "福岡", country: "JP", platform: "Shopify", note: "エチオピアの名店", coord: [130.4, 33.59], url: "manucoffee.com",
    founded: "2007", style: "浅〜中浅煎り・季節替わり", ship: "国内発送(2〜4日)", focus: "エチオピア・コロンビア",
    bio: "福岡を拠点とする日本のスペシャルティロースター。エチオピア・コロンビアを軸に、素材感を活かした焙煎で知られる。" },
  nem: { name: "Nem Coffee & Espresso", city: "東京", country: "JP", platform: "Shopify", note: "エチオピアの名店", coord: [139.7, 35.66],
    founded: "2013", style: "浅〜中浅煎り・季節替わり", ship: "国内発送(2〜4日)", focus: "エチオピア・コロンビア",
    bio: "東京を拠点とする日本のスペシャルティロースター。エチオピア・コロンビアを軸に、素材感を活かした焙煎で知られる。" },
  kannon: { name: "Kannon Coffee", city: "名古屋", country: "JP", platform: "Shopify", note: "エチオピアの名店", coord: [136.91, 35.18], url: "kannoncoffee.com",
    founded: "2014", style: "浅〜中浅煎り・季節替わり", ship: "国内発送(2〜4日)", focus: "エチオピア・コロンビア",
    bio: "名古屋を拠点とする日本のスペシャルティロースター。エチオピア・コロンビアを軸に、素材感を活かした焙煎で知られる。" },
  thelocal: { name: "The Local Coffee Stand", city: "東京", country: "JP", platform: "Shopify", note: "エチオピアの名店", coord: [139.7, 35.66],
    founded: "2015", style: "浅〜中浅煎り・季節替わり", ship: "国内発送(2〜4日)", focus: "エチオピア・コロンビア",
    bio: "東京を拠点とする日本のスペシャルティロースター。エチオピア・コロンビアを軸に、素材感を活かした焙煎で知られる。" },
  sanwa: { name: "Sanwa Coffee Works", city: "大阪", country: "JP", platform: "Shopify", note: "エチオピアの名店", coord: [135.5, 34.69],
    founded: "2015", style: "浅〜中浅煎り・季節替わり", ship: "国内発送(2〜4日)", focus: "エチオピア・コロンビア",
    bio: "大阪を拠点とする日本のスペシャルティロースター。エチオピア・コロンビアを軸に、素材感を活かした焙煎で知られる。" },
  coffeevalley: { name: "Coffee Valley", city: "東京", country: "JP", platform: "Shopify", note: "エチオピアの名店", coord: [139.7, 35.66],
    founded: "2008", style: "浅〜中浅煎り・季節替わり", ship: "国内発送(2〜4日)", focus: "エチオピア・コロンビア",
    bio: "東京を拠点とする日本のスペシャルティロースター。エチオピア・コロンビアを軸に、素材感を活かした焙煎で知られる。" },
  terarosa: { name: "Terarosa", city: "江陵", country: "KR", platform: "Shopify", note: "エチオピアの名店", coord: [128.9, 37.75], url: "terarosa.com",
    founded: "2002", style: "浅〜中浅煎り・アジア", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "江陵を拠点とする韓国のスペシャルティロースター。エチオピア・コロンビアを軸に、素材感を活かした焙煎で知られる。" },
  namusairo: { name: "Namusairo", city: "ソウル", country: "KR", platform: "Shopify", note: "エチオピアの名店", coord: [126.98, 37.57], url: "namusairo.com",
    founded: "2002", style: "浅〜中浅煎り・アジア", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "ソウルを拠点とする韓国のスペシャルティロースター。エチオピア・コロンビアを軸に、素材感を活かした焙煎で知られる。" },
  protokoll: { name: "Protokoll", city: "ソウル", country: "KR", platform: "Shopify", note: "エチオピアの名店", coord: [126.98, 37.57],
    founded: "2016", style: "浅〜中浅煎り・アジア", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "ソウルを拠点とする韓国のスペシャルティロースター。エチオピア・コロンビアを軸に、素材感を活かした焙煎で知られる。" },
  manufact: { name: "Manufact Coffee", city: "ソウル", country: "KR", platform: "Shopify", note: "エチオピアの名店", coord: [126.98, 37.57], url: "manufact.co.kr",
    founded: "2016", style: "浅〜中浅煎り・アジア", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "ソウルを拠点とする韓国のスペシャルティロースター。エチオピア・コロンビアを軸に、素材感を活かした焙煎で知られる。" },
  coffeegraffiti: { name: "Coffee Graffiti", city: "ソウル", country: "KR", platform: "Shopify", note: "エチオピアの名店", coord: [126.98, 37.57],
    founded: "2011", style: "浅〜中浅煎り・アジア", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "ソウルを拠点とする韓国のスペシャルティロースター。エチオピア・コロンビアを軸に、素材感を活かした焙煎で知られる。" },
  fiveextracts: { name: "Five Extracts", city: "ソウル", country: "KR", platform: "Shopify", note: "エチオピアの名店", coord: [126.98, 37.57],
    founded: "2013", style: "浅〜中浅煎り・アジア", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "ソウルを拠点とする韓国のスペシャルティロースター。エチオピア・コロンビアを軸に、素材感を活かした焙煎で知られる。" },
  felt: { name: "Felt Coffee", city: "ソウル", country: "KR", platform: "Shopify", note: "エチオピアの名店", coord: [126.98, 37.57], url: "felt.coffee",
    founded: "2015", style: "浅〜中浅煎り・アジア", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "ソウルを拠点とする韓国のスペシャルティロースター。エチオピア・コロンビアを軸に、素材感を活かした焙煎で知られる。" },
  lowkey: { name: "Low Key", city: "ソウル", country: "KR", platform: "Shopify", note: "エチオピアの名店", coord: [126.98, 37.57],
    founded: "2018", style: "浅〜中浅煎り・アジア", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "ソウルを拠点とする韓国のスペシャルティロースター。エチオピア・コロンビアを軸に、素材感を活かした焙煎で知られる。" },
  mesh: { name: "Mesh Coffee", city: "ソウル", country: "KR", platform: "Shopify", note: "エチオピアの名店", coord: [126.98, 37.57],
    founded: "2016", style: "浅〜中浅煎り・アジア", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "ソウルを拠点とする韓国のスペシャルティロースター。エチオピア・コロンビアを軸に、素材感を活かした焙煎で知られる。" },
  beanbrothers: { name: "Bean Brothers", city: "ソウル", country: "KR", platform: "Shopify", note: "エチオピアの名店", coord: [126.98, 37.57], url: "beanbrothers.co.kr",
    founded: "2013", style: "浅〜中浅煎り・アジア", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "ソウルを拠点とする韓国のスペシャルティロースター。エチオピア・コロンビアを軸に、素材感を活かした焙煎で知られる。" },
  hellcafe: { name: "Hell Cafe Roasters", city: "ソウル", country: "KR", platform: "Shopify", note: "エチオピアの名店", coord: [126.98, 37.57],
    founded: "2014", style: "浅〜中浅煎り・アジア", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "ソウルを拠点とする韓国のスペシャルティロースター。エチオピア・コロンビアを軸に、素材感を活かした焙煎で知られる。" },
  peer: { name: "Peer Coffee", city: "ソウル", country: "KR", platform: "Shopify", note: "エチオピアの名店", coord: [126.98, 37.57],
    founded: "2017", style: "浅〜中浅煎り・アジア", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "ソウルを拠点とする韓国のスペシャルティロースター。エチオピア・コロンビアを軸に、素材感を活かした焙煎で知られる。" },
  elcafe: { name: "El Cafe Coffee", city: "ソウル", country: "KR", platform: "Shopify", note: "エチオピアの名店", coord: [126.98, 37.57],
    founded: "2015", style: "浅〜中浅煎り・アジア", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "ソウルを拠点とする韓国のスペシャルティロースター。エチオピア・コロンビアを軸に、素材感を活かした焙煎で知られる。" },
  seesaw: { name: "Seesaw Coffee", city: "上海", country: "CN", platform: "Shopify", note: "雲南の名店", coord: [121.47, 31.23], url: "seesawcoffee.com",
    founded: "2012", style: "浅〜中浅煎り・アジア", ship: "海外発送(1〜2週間)", focus: "雲南・シングルオリジン",
    bio: "上海を拠点とする中国のスペシャルティロースター。雲南・シングルオリジンを軸に、素材感を活かした焙煎で知られる。" },
  metalhands: { name: "Metal Hands", city: "北京", country: "CN", platform: "Shopify", note: "雲南の名店", coord: [116.4, 39.9],
    founded: "2016", style: "浅〜中浅煎り・アジア", ship: "海外発送(1〜2週間)", focus: "雲南・シングルオリジン",
    bio: "北京を拠点とする中国のスペシャルティロースター。雲南・シングルオリジンを軸に、素材感を活かした焙煎で知られる。" },
  fisheye: { name: "Fisheye Coffee", city: "北京", country: "CN", platform: "Shopify", note: "雲南の名店", coord: [116.4, 39.9],
    founded: "2010", style: "浅〜中浅煎り・アジア", ship: "海外発送(1〜2週間)", focus: "雲南・シングルオリジン",
    bio: "北京を拠点とする中国のスペシャルティロースター。雲南・シングルオリジンを軸に、素材感を活かした焙煎で知られる。" },
  torch: { name: "Torch Coffee", city: "昆明", country: "CN", platform: "Shopify", note: "雲南の名店", coord: [102.83, 24.88],
    founded: "2013", style: "浅〜中浅煎り・アジア", ship: "海外発送(1〜2週間)", focus: "雲南・シングルオリジン",
    bio: "昆明を拠点とする中国のスペシャルティロースター。雲南・シングルオリジンを軸に、素材感を活かした焙煎で知られる。" },
  mstand: { name: "M Stand", city: "上海", country: "CN", platform: "Shopify", note: "雲南の名店", coord: [121.47, 31.23],
    founded: "2017", style: "浅〜中浅煎り・アジア", ship: "海外発送(1〜2週間)", focus: "雲南・シングルオリジン",
    bio: "上海を拠点とする中国のスペシャルティロースター。雲南・シングルオリジンを軸に、素材感を活かした焙煎で知られる。" },
  unicafe: { name: "Uni Uni", city: "上海", country: "CN", platform: "Shopify", note: "雲南の名店", coord: [121.47, 31.23],
    founded: "2018", style: "浅〜中浅煎り・アジア", ship: "海外発送(1〜2週間)", focus: "雲南・シングルオリジン",
    bio: "上海を拠点とする中国のスペシャルティロースター。雲南・シングルオリジンを軸に、素材感を活かした焙煎で知られる。" },
  sumo: { name: "Sumo Coffee", city: "上海", country: "CN", platform: "Shopify", note: "雲南の名店", coord: [121.47, 31.23],
    founded: "2019", style: "浅〜中浅煎り・アジア", ship: "海外発送(1〜2週間)", focus: "雲南・シングルオリジン",
    bio: "上海を拠点とする中国のスペシャルティロースター。雲南・シングルオリジンを軸に、素材感を活かした焙煎で知られる。" },
  berrybeans: { name: "Berry Beans", city: "北京", country: "CN", platform: "Shopify", note: "雲南の名店", coord: [116.4, 39.9],
    founded: "2013", style: "浅〜中浅煎り・アジア", ship: "海外発送(1〜2週間)", focus: "雲南・シングルオリジン",
    bio: "北京を拠点とする中国のスペシャルティロースター。雲南・シングルオリジンを軸に、素材感を活かした焙煎で知られる。" },
  ops: { name: "O.P.S Cafe", city: "上海", country: "CN", platform: "Shopify", note: "雲南の名店", coord: [121.47, 31.23],
    founded: "2016", style: "浅〜中浅煎り・アジア", ship: "海外発送(1〜2週間)", focus: "雲南・シングルオリジン",
    bio: "上海を拠点とする中国のスペシャルティロースター。雲南・シングルオリジンを軸に、素材感を活かした焙煎で知られる。" },
  greybox: { name: "Greybox Coffee", city: "上海", country: "CN", platform: "Shopify", note: "雲南の名店", coord: [121.47, 31.23],
    founded: "2016", style: "浅〜中浅煎り・アジア", ship: "海外発送(1〜2週間)", focus: "雲南・シングルオリジン",
    bio: "上海を拠点とする中国のスペシャルティロースター。雲南・シングルオリジンを軸に、素材感を活かした焙煎で知られる。" },
  fluid: { name: "Fluid Coffee", city: "上海", country: "CN", platform: "Shopify", note: "雲南の名店", coord: [121.47, 31.23],
    founded: "2017", style: "浅〜中浅煎り・アジア", ship: "海外発送(1〜2週間)", focus: "雲南・シングルオリジン",
    bio: "上海を拠点とする中国のスペシャルティロースター。雲南・シングルオリジンを軸に、素材感を活かした焙煎で知られる。" },
  simplekaffa: { name: "Simple Kaffa", city: "台北", country: "TW", platform: "Shopify", note: "台湾の名店", coord: [121.56, 25.03], url: "simplekaffa.com",
    founded: "2013", style: "浅〜中浅煎り・アジア", ship: "海外発送(1〜2週間)", focus: "台湾・シングルオリジン",
    bio: "台北を拠点とする台湾のスペシャルティロースター。台湾・シングルオリジンを軸に、素材感を活かした焙煎で知られる。" },
  fikafika: { name: "Fika Fika Cafe", city: "台北", country: "TW", platform: "Shopify", note: "台湾の名店", coord: [121.56, 25.03], url: "fikafikacafe.com",
    founded: "2013", style: "浅〜中浅煎り・アジア", ship: "海外発送(1〜2週間)", focus: "台湾・シングルオリジン",
    bio: "台北を拠点とする台湾のスペシャルティロースター。台湾・シングルオリジンを軸に、素材感を活かした焙煎で知られる。" },
  vwi: { name: "VWI by CHADWANG", city: "台北", country: "TW", platform: "Shopify", note: "台湾の名店", coord: [121.56, 25.03],
    founded: "2017", style: "浅〜中浅煎り・アジア", ship: "海外発送(1〜2週間)", focus: "台湾・シングルオリジン",
    bio: "台北を拠点とする台湾のスペシャルティロースター。台湾・シングルオリジンを軸に、素材感を活かした焙煎で知られる。" },
  peacelove: { name: "Peace & Love Cafe", city: "台北", country: "TW", platform: "Shopify", note: "台湾の名店", coord: [121.56, 25.03],
    founded: "2014", style: "浅〜中浅煎り・アジア", ship: "海外発送(1〜2週間)", focus: "台湾・シングルオリジン",
    bio: "台北を拠点とする台湾のスペシャルティロースター。台湾・シングルオリジンを軸に、素材感を活かした焙煎で知られる。" },
  gabee: { name: "GABEE", city: "台北", country: "TW", platform: "Shopify", note: "台湾の名店", coord: [121.56, 25.03], url: "gabee.org",
    founded: "2004", style: "浅〜中浅煎り・アジア", ship: "海外発送(1〜2週間)", focus: "台湾・シングルオリジン",
    bio: "台北を拠点とする台湾のスペシャルティロースター。台湾・シングルオリジンを軸に、素材感を活かした焙煎で知られる。" },
  rufous: { name: "Rufous Coffee", city: "台北", country: "TW", platform: "Shopify", note: "台湾の名店", coord: [121.56, 25.03],
    founded: "2007", style: "浅〜中浅煎り・アジア", ship: "海外発送(1〜2週間)", focus: "台湾・シングルオリジン",
    bio: "台北を拠点とする台湾のスペシャルティロースター。台湾・シングルオリジンを軸に、素材感を活かした焙煎で知られる。" },
  coffeestopover: { name: "Coffee Stopover", city: "台中", country: "TW", platform: "Shopify", note: "台湾の名店", coord: [120.68, 24.14],
    founded: "2014", style: "浅〜中浅煎り・アジア", ship: "海外発送(1〜2週間)", focus: "台湾・シングルオリジン",
    bio: "台中を拠点とする台湾のスペシャルティロースター。台湾・シングルオリジンを軸に、素材感を活かした焙煎で知られる。" },
  congrats: { name: "Congrats Cafe", city: "台北", country: "TW", platform: "Shopify", note: "台湾の名店", coord: [121.56, 25.03],
    founded: "2015", style: "浅〜中浅煎り・アジア", ship: "海外発送(1〜2週間)", focus: "台湾・シングルオリジン",
    bio: "台北を拠点とする台湾のスペシャルティロースター。台湾・シングルオリジンを軸に、素材感を活かした焙煎で知られる。" },
  coffeesind: { name: "Coffee Sind", city: "台北", country: "TW", platform: "Shopify", note: "台湾の名店", coord: [121.56, 25.03],
    founded: "2012", style: "浅〜中浅煎り・アジア", ship: "海外発送(1〜2週間)", focus: "台湾・シングルオリジン",
    bio: "台北を拠点とする台湾のスペシャルティロースター。台湾・シングルオリジンを軸に、素材感を活かした焙煎で知られる。" },
  mojocoffee: { name: "The Factory / Mojocoffee", city: "台中", country: "TW", platform: "Shopify", note: "台湾の名店", coord: [120.68, 24.14], url: "mojocoffee.com.tw",
    founded: "2004", style: "浅〜中浅煎り・アジア", ship: "海外発送(1〜2週間)", focus: "台湾・シングルオリジン",
    bio: "台中を拠点とする台湾のスペシャルティロースター。台湾・シングルオリジンを軸に、素材感を活かした焙煎で知られる。" },
  blackstar: { name: "Black Star Coffee", city: "台北", country: "TW", platform: "Shopify", note: "台湾の名店", coord: [121.56, 25.03],
    founded: "2016", style: "浅〜中浅煎り・アジア", ship: "海外発送(1〜2週間)", focus: "台湾・シングルオリジン",
    bio: "台北を拠点とする台湾のスペシャルティロースター。台湾・シングルオリジンを軸に、素材感を活かした焙煎で知られる。" },
  fineprint: { name: "Fineprint Co", city: "香港", country: "HK", platform: "Shopify", note: "エチオピアの名店", coord: [114.17, 22.28], url: "fineprintco.com",
    founded: "2016", style: "浅〜中浅煎り・アジア", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "香港を拠点とする香港のスペシャルティロースター。エチオピア・コロンビアを軸に、素材感を活かした焙煎で知られる。" },
  sensoryzero: { name: "Sensory Zero", city: "香港", country: "HK", platform: "Shopify", note: "エチオピアの名店", coord: [114.17, 22.28],
    founded: "2015", style: "浅〜中浅煎り・アジア", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "香港を拠点とする香港のスペシャルティロースター。エチオピア・コロンビアを軸に、素材感を活かした焙煎で知られる。" },
  winstons: { name: "Winstons Coffee", city: "香港", country: "HK", platform: "Shopify", note: "エチオピアの名店", coord: [114.17, 22.28],
    founded: "2016", style: "浅〜中浅煎り・アジア", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "香港を拠点とする香港のスペシャルティロースター。エチオピア・コロンビアを軸に、素材感を活かした焙煎で知られる。" },
  dutchcolony: { name: "Dutch Colony Coffee", city: "Singapore", country: "SG", platform: "Shopify", note: "エチオピアの名店", coord: [103.85, 1.29], url: "dutchcolony.sg",
    founded: "2015", style: "浅〜中浅煎り・アジア", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "Singaporeを拠点とするシンガポールのスペシャルティロースター。エチオピア・コロンビアを軸に、素材感を活かした焙煎で知られる。" },
  homeground: { name: "Homeground Coffee", city: "Singapore", country: "SG", platform: "Shopify", note: "エチオピアの名店", coord: [103.85, 1.29], url: "homegroundcoffeeroasters.com",
    founded: "2018", style: "浅〜中浅煎り・アジア", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "Singaporeを拠点とするシンガポールのスペシャルティロースター。エチオピア・コロンビアを軸に、素材感を活かした焙煎で知られる。" },
  alchemist: { name: "Alchemist", city: "Singapore", country: "SG", platform: "Shopify", note: "エチオピアの名店", coord: [103.85, 1.29], url: "alchemist.com.sg",
    founded: "2017", style: "浅〜中浅煎り・アジア", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "Singaporeを拠点とするシンガポールのスペシャルティロースター。エチオピア・コロンビアを軸に、素材感を活かした焙煎で知られる。" },
  maxi: { name: "Maxi Coffee Bar", city: "Singapore", country: "SG", platform: "Shopify", note: "エチオピアの名店", coord: [103.85, 1.29],
    founded: "2016", style: "浅〜中浅煎り・アジア", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "Singaporeを拠点とするシンガポールのスペシャルティロースター。エチオピア・コロンビアを軸に、素材感を活かした焙煎で知られる。" },
  brave: { name: "Brave Roasters", city: "Bangkok", country: "TH", platform: "Shopify", note: "タイの名店", coord: [100.5, 13.76], url: "braveroasters.com",
    founded: "2016", style: "浅〜中浅煎り・アジア", ship: "海外発送(1〜2週間)", focus: "タイ・シングルオリジン",
    bio: "Bangkokを拠点とするタイのスペシャルティロースター。タイ・シングルオリジンを軸に、素材感を活かした焙煎で知られる。" },
  pacamara: { name: "Pacamara Coffee", city: "Bangkok", country: "TH", platform: "Shopify", note: "タイの名店", coord: [100.5, 13.76], url: "pacamara-coffee.com",
    founded: "2013", style: "浅〜中浅煎り・アジア", ship: "海外発送(1〜2週間)", focus: "タイ・シングルオリジン",
    bio: "Bangkokを拠点とするタイのスペシャルティロースター。タイ・シングルオリジンを軸に、素材感を活かした焙煎で知られる。" },
  gallerydrip: { name: "Gallery Drip Coffee", city: "Bangkok", country: "TH", platform: "Shopify", note: "タイの名店", coord: [100.5, 13.76],
    founded: "2013", style: "浅〜中浅煎り・アジア", ship: "海外発送(1〜2週間)", focus: "タイ・シングルオリジン",
    bio: "Bangkokを拠点とするタイのスペシャルティロースター。タイ・シングルオリジンを軸に、素材感を活かした焙煎で知られる。" },
  rework: { name: "Rework Coffee", city: "Bangkok", country: "TH", platform: "Shopify", note: "タイの名店", coord: [100.5, 13.76],
    founded: "2017", style: "浅〜中浅煎り・アジア", ship: "海外発送(1〜2週間)", focus: "タイ・シングルオリジン",
    bio: "Bangkokを拠点とするタイのスペシャルティロースター。タイ・シングルオリジンを軸に、素材感を活かした焙煎で知られる。" },
  factory43: { name: "43 Factory", city: "Ho Chi Minh", country: "VN", platform: "Shopify", note: "ベトナムの名店", coord: [106.66, 10.78], url: "43factory.coffee",
    founded: "2019", style: "浅〜中浅煎り・アジア", ship: "海外発送(1〜2週間)", focus: "ベトナム・アラビカ",
    bio: "Ho Chi Minhを拠点とするベトナムのスペシャルティロースター。ベトナム・アラビカを軸に、素材感を活かした焙煎で知られる。" },
  laviet: { name: "La Viet Coffee", city: "Da Lat", country: "VN", platform: "Shopify", note: "ベトナムの名店", coord: [108.44, 11.94], url: "laviet.coffee",
    founded: "2015", style: "浅〜中浅煎り・アジア", ship: "海外発送(1〜2週間)", focus: "ベトナム・アラビカ",
    bio: "Da Latを拠点とするベトナムのスペシャルティロースター。ベトナム・アラビカを軸に、素材感を活かした焙煎で知られる。" },
  shin: { name: "Shin Coffee", city: "Ho Chi Minh", country: "VN", platform: "Shopify", note: "ベトナムの名店", coord: [106.66, 10.78], url: "shincaphe.vn",
    founded: "2016", style: "浅〜中浅煎り・アジア", ship: "海外発送(1〜2週間)", focus: "ベトナム・アラビカ",
    bio: "Ho Chi Minhを拠点とするベトナムのスペシャルティロースター。ベトナム・アラビカを軸に、素材感を活かした焙煎で知られる。" },
  everyhalf: { name: "Every Half Coffee", city: "Ho Chi Minh", country: "VN", platform: "Shopify", note: "ベトナムの名店", coord: [106.66, 10.78],
    founded: "2018", style: "浅〜中浅煎り・アジア", ship: "海外発送(1〜2週間)", focus: "ベトナム・アラビカ",
    bio: "Ho Chi Minhを拠点とするベトナムのスペシャルティロースター。ベトナム・アラビカを軸に、素材感を活かした焙煎で知られる。" },
  raaw: { name: "RAAW Coffee", city: "Ho Chi Minh", country: "VN", platform: "Shopify", note: "ベトナムの名店", coord: [106.66, 10.78],
    founded: "2019", style: "浅〜中浅煎り・アジア", ship: "海外発送(1〜2週間)", focus: "ベトナム・アラビカ",
    bio: "Ho Chi Minhを拠点とするベトナムのスペシャルティロースター。ベトナム・アラビカを軸に、素材感を活かした焙煎で知られる。" },
  theworkshop: { name: "The Workshop Coffee", city: "Ho Chi Minh", country: "VN", platform: "Shopify", note: "ベトナムの名店", coord: [106.66, 10.78],
    founded: "2014", style: "浅〜中浅煎り・アジア", ship: "海外発送(1〜2週間)", focus: "ベトナム・アラビカ",
    bio: "Ho Chi Minhを拠点とするベトナムのスペシャルティロースター。ベトナム・アラビカを軸に、素材感を活かした焙煎で知られる。" },
  blackbird: { name: "Blackbird Coffee", city: "Hanoi", country: "VN", platform: "Shopify", note: "ベトナムの名店", coord: [105.83, 21.03],
    founded: "2017", style: "浅〜中浅煎り・アジア", ship: "海外発送(1〜2週間)", focus: "ベトナム・アラビカ",
    bio: "Hanoiを拠点とするベトナムのスペシャルティロースター。ベトナム・アラビカを軸に、素材感を活かした焙煎で知られる。" },
  tanamera: { name: "Tanamera Coffee", city: "Jakarta", country: "ID", platform: "Shopify", note: "インドネシアの名店", coord: [106.83, -6.21], url: "tanameracoffee.co.id",
    founded: "2013", style: "浅〜中浅煎り・アジア", ship: "海外発送(1〜2週間)", focus: "インドネシア・シングルオリジン",
    bio: "Jakartaを拠点とするインドネシアのスペシャルティロースター。インドネシア・シングルオリジンを軸に、素材感を活かした焙煎で知られる。" },
  anomali: { name: "Anomali Coffee", city: "Jakarta", country: "ID", platform: "Shopify", note: "インドネシアの名店", coord: [106.83, -6.21], url: "anomalicoffee.com",
    founded: "2007", style: "浅〜中浅煎り・アジア", ship: "海外発送(1〜2週間)", focus: "インドネシア・シングルオリジン",
    bio: "Jakartaを拠点とするインドネシアのスペシャルティロースター。インドネシア・シングルオリジンを軸に、素材感を活かした焙煎で知られる。" },
  expat: { name: "Expat Roasters", city: "Bali", country: "ID", platform: "Shopify", note: "インドネシアの名店", coord: [115.19, -8.41], url: "expatroasters.com",
    founded: "2017", style: "浅〜中浅煎り・アジア", ship: "海外発送(1〜2週間)", focus: "インドネシア・シングルオリジン",
    bio: "Baliを拠点とするインドネシアのスペシャルティロースター。インドネシア・シングルオリジンを軸に、素材感を活かした焙煎で知られる。" },
  firstcrack: { name: "First Crack", city: "Jakarta", country: "ID", platform: "Shopify", note: "インドネシアの名店", coord: [106.83, -6.21],
    founded: "2019", style: "浅〜中浅煎り・アジア", ship: "海外発送(1〜2週間)", focus: "インドネシア・シングルオリジン",
    bio: "Jakartaを拠点とするインドネシアのスペシャルティロースター。インドネシア・シングルオリジンを軸に、素材感を活かした焙煎で知られる。" },
  kina: { name: "KINA", city: "Jakarta", country: "ID", platform: "Shopify", note: "インドネシアの名店", coord: [106.83, -6.21],
    founded: "2020", style: "浅〜中浅煎り・アジア", ship: "海外発送(1〜2週間)", focus: "インドネシア・シングルオリジン",
    bio: "Jakartaを拠点とするインドネシアのスペシャルティロースター。インドネシア・シングルオリジンを軸に、素材感を活かした焙煎で知られる。" },
  commongrounds: { name: "Common Grounds", city: "Jakarta", country: "ID", platform: "Shopify", note: "インドネシアの名店", coord: [106.83, -6.21],
    founded: "2013", style: "浅〜中浅煎り・アジア", ship: "海外発送(1〜2週間)", focus: "インドネシア・シングルオリジン",
    bio: "Jakartaを拠点とするインドネシアのスペシャルティロースター。インドネシア・シングルオリジンを軸に、素材感を活かした焙煎で知られる。" },
  crematology: { name: "Crematology", city: "Jakarta", country: "ID", platform: "Shopify", note: "インドネシアの名店", coord: [106.83, -6.21],
    founded: "2015", style: "浅〜中浅煎り・アジア", ship: "海外発送(1〜2週間)", focus: "インドネシア・シングルオリジン",
    bio: "Jakartaを拠点とするインドネシアのスペシャルティロースター。インドネシア・シングルオリジンを軸に、素材感を活かした焙煎で知られる。" },
  seniman: { name: "Seniman Coffee", city: "Bali", country: "ID", platform: "Shopify", note: "インドネシアの名店", coord: [115.19, -8.41], url: "senimancoffee.com",
    founded: "2011", style: "浅〜中浅煎り・アジア", ship: "海外発送(1〜2週間)", focus: "インドネシア・シングルオリジン",
    bio: "Baliを拠点とするインドネシアのスペシャルティロースター。インドネシア・シングルオリジンを軸に、素材感を活かした焙煎で知られる。" },
  kopikalyan: { name: "Kopikalyan", city: "Jakarta", country: "ID", platform: "Shopify", note: "インドネシアの名店", coord: [106.83, -6.21],
    founded: "2016", style: "浅〜中浅煎り・アジア", ship: "海外発送(1〜2週間)", focus: "インドネシア・シングルオリジン",
    bio: "Jakartaを拠点とするインドネシアのスペシャルティロースター。インドネシア・シングルオリジンを軸に、素材感を活かした焙煎で知られる。" },
  vcr: { name: "VCR", city: "Kuala Lumpur", country: "MY", platform: "Shopify", note: "エチオピアの名店", coord: [101.69, 3.14], url: "vcr.my",
    founded: "2011", style: "浅〜中浅煎り・アジア", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "Kuala Lumpurを拠点とするマレーシアのスペシャルティロースター。エチオピア・コロンビアを軸に、素材感を活かした焙煎で知られる。" },
  pulp: { name: "PULP by Papa Palheta", city: "Kuala Lumpur", country: "MY", platform: "Shopify", note: "エチオピアの名店", coord: [101.69, 3.14],
    founded: "2013", style: "浅〜中浅煎り・アジア", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "Kuala Lumpurを拠点とするマレーシアのスペシャルティロースター。エチオピア・コロンビアを軸に、素材感を活かした焙煎で知られる。" },
  threelittlebirds: { name: "Three Little Birds", city: "Kuala Lumpur", country: "MY", platform: "Shopify", note: "エチオピアの名店", coord: [101.69, 3.14],
    founded: "2013", style: "浅〜中浅煎り・アジア", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "Kuala Lumpurを拠点とするマレーシアのスペシャルティロースター。エチオピア・コロンビアを軸に、素材感を活かした焙煎で知られる。" },
  coffea: { name: "Coffea Coffee", city: "Kuala Lumpur", country: "MY", platform: "Shopify", note: "エチオピアの名店", coord: [101.69, 3.14],
    founded: "2014", style: "浅〜中浅煎り・アジア", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "Kuala Lumpurを拠点とするマレーシアのスペシャルティロースター。エチオピア・コロンビアを軸に、素材感を活かした焙煎で知られる。" },
  artisanmy: { name: "Artisan Roastery", city: "Kuala Lumpur", country: "MY", platform: "Shopify", note: "エチオピアの名店", coord: [101.69, 3.14],
    founded: "2015", style: "浅〜中浅煎り・アジア", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "Kuala Lumpurを拠点とするマレーシアのスペシャルティロースター。エチオピア・コロンビアを軸に、素材感を活かした焙煎で知られる。" },
  yardstick: { name: "Yardstick Coffee", city: "Manila", country: "PH", platform: "Shopify", note: "フィリピンの名店", coord: [120.98, 14.6], url: "yardstickcoffee.com",
    founded: "2015", style: "浅〜中浅煎り・アジア", ship: "海外発送(1〜2週間)", focus: "フィリピン・シングルオリジン",
    bio: "Manilaを拠点とするフィリピンのスペシャルティロースター。フィリピン・シングルオリジンを軸に、素材感を活かした焙煎で知られる。" },
  edsa: { name: "EDSA Beverage Design", city: "Manila", country: "PH", platform: "Shopify", note: "フィリピンの名店", coord: [120.98, 14.6],
    founded: "2014", style: "浅〜中浅煎り・アジア", ship: "海外発送(1〜2週間)", focus: "フィリピン・シングルオリジン",
    bio: "Manilaを拠点とするフィリピンのスペシャルティロースター。フィリピン・シングルオリジンを軸に、素材感を活かした焙煎で知られる。" },
  kalsada: { name: "Kalsada Coffee", city: "Manila", country: "PH", platform: "Shopify", note: "フィリピンの名店", coord: [120.98, 14.6], url: "kalsada.com",
    founded: "2014", style: "浅〜中浅煎り・アジア", ship: "海外発送(1〜2週間)", focus: "フィリピン・シングルオリジン",
    bio: "Manilaを拠点とするフィリピンのスペシャルティロースター。フィリピン・シングルオリジンを軸に、素材感を活かした焙煎で知られる。" },
  habitual: { name: "Habitual Coffee", city: "Manila", country: "PH", platform: "Shopify", note: "フィリピンの名店", coord: [120.98, 14.6],
    founded: "2017", style: "浅〜中浅煎り・アジア", ship: "海外発送(1〜2週間)", focus: "フィリピン・シングルオリジン",
    bio: "Manilaを拠点とするフィリピンのスペシャルティロースター。フィリピン・シングルオリジンを軸に、素材感を活かした焙煎で知られる。" },
  bluetokai: { name: "Blue Tokai", city: "Delhi", country: "IN", platform: "Shopify", note: "インドの名店", coord: [77.21, 28.61], url: "bluetokaicoffee.com",
    founded: "2013", style: "浅〜中浅煎り・アジア", ship: "海外発送(1〜2週間)", focus: "インド・シングルオリジン",
    bio: "Delhiを拠点とするインドのスペシャルティロースター。インド・シングルオリジンを軸に、素材感を活かした焙煎で知られる。" },
  thirdwave: { name: "Third Wave Coffee", city: "Bangalore", country: "IN", platform: "Shopify", note: "インドの名店", coord: [77.59, 12.97],
    founded: "2016", style: "浅〜中浅煎り・アジア", ship: "海外発送(1〜2週間)", focus: "インド・シングルオリジン",
    bio: "Bangaloreを拠点とするインドのスペシャルティロースター。インド・シングルオリジンを軸に、素材感を活かした焙煎で知られる。" },
  kcroasters: { name: "KC Roasters", city: "Mumbai", country: "IN", platform: "Shopify", note: "インドの名店", coord: [72.88, 19.08], url: "kcroasters.com",
    founded: "2017", style: "浅〜中浅煎り・アジア", ship: "海外発送(1〜2週間)", focus: "インド・シングルオリジン",
    bio: "Mumbaiを拠点とするインドのスペシャルティロースター。インド・シングルオリジンを軸に、素材感を活かした焙煎で知られる。" },
  corridorseven: { name: "Corridor Seven", city: "Nagpur", country: "IN", platform: "Shopify", note: "インドの名店", coord: [79.09, 21.15], url: "corridorseven.coffee",
    founded: "2017", style: "浅〜中浅煎り・アジア", ship: "海外発送(1〜2週間)", focus: "インド・シングルオリジン",
    bio: "Nagpurを拠点とするインドのスペシャルティロースター。インド・シングルオリジンを軸に、素材感を活かした焙煎で知られる。" },
  naivo: { name: "Naivo Cafe", city: "Bangalore", country: "IN", platform: "Shopify", note: "インドの名店", coord: [77.59, 12.97],
    founded: "2018", style: "浅〜中浅煎り・アジア", ship: "海外発送(1〜2週間)", focus: "インド・シングルオリジン",
    bio: "Bangaloreを拠点とするインドのスペシャルティロースター。インド・シングルオリジンを軸に、素材感を活かした焙煎で知られる。" },
};

const BEANS = [
  { id: 1, r: "bibi", name: "Ethiopia Chelbesa", origin: "エチオピア", process: "Washed", amount: 1800, cur: "JPY", per: "150g", status: "now", color: "#DCD6C8", accent: "#8A3B2E", year: "2026" },
  { id: 2, r: "bibi", name: "Colombia El Paraíso", origin: "コロンビア", process: "Anaerobic", amount: 2200, cur: "JPY", per: "150g", status: "sold", color: "#2E2A24", accent: "#C8A96A", year: "2026" },
  { id: 3, r: "bibi", name: "Kenya Karimikui", origin: "ケニア", process: "Washed", amount: 2000, cur: "JPY", per: "150g", status: "archive", color: "#B8433A", accent: "#F2E9DC", year: "2025" },
  { id: 4, r: "tw", name: "Karogoto AA", origin: "ケニア", process: "Washed", amount: 165, cur: "NOK", per: "250g", status: "now", color: "#F4F1E8", accent: "#1A1815", year: "2026" },
  { id: 5, r: "tw", name: "Finca Tamana", origin: "コロンビア", process: "Washed", amount: 145, cur: "NOK", per: "250g", status: "now", color: "#EFE9DA", accent: "#2F5233", year: "2026" },
  { id: 6, r: "tw", name: "Hunkute", origin: "エチオピア", process: "Washed", amount: 155, cur: "NOK", per: "250g", status: "sold", color: "#E8E2D2", accent: "#A87B2E", year: "2026" },
  { id: 7, r: "tw", name: "La Palma Geisha", origin: "コロンビア", process: "Natural", amount: 320, cur: "NOK", per: "100g", status: "archive", color: "#D9D2C0", accent: "#8A3B2E", year: "2024", vt: "geisha" },
  { id: 8, r: "onyx", name: "Geometry", origin: "ブレンド", process: "Washed / Natural", amount: 19, cur: "USD", per: "10oz", status: "now", color: "#1C1B19", accent: "#E8E2D2", year: "2026" },
  { id: 9, r: "onyx", name: "Ethiopia Hambela", origin: "エチオピア", process: "Natural", amount: 24, cur: "USD", per: "10oz", status: "now", color: "#3A2E4F", accent: "#D9B44A", year: "2026" },
  { id: 10, r: "onyx", name: "Colombia Aponte", origin: "コロンビア", process: "Honey", amount: 22, cur: "USD", per: "10oz", status: "sold", color: "#6B2D3C", accent: "#EFE9DA", year: "2026" },
  { id: 11, r: "onyx", name: "Monarch", origin: "ブレンド", process: "Natural", amount: 18, cur: "USD", per: "10oz", status: "archive", color: "#22303A", accent: "#C8792E", year: "2023" },
  { id: 12, r: "cc", name: "Kieni", origin: "ケニア", process: "Washed", amount: 120, cur: "DKK", per: "250g", status: "now", color: "#F2EFE6", accent: "#B8433A", year: "2026" },
  { id: 13, r: "cc", name: "Akmel Nuri", origin: "エチオピア", process: "Natural", amount: 115, cur: "DKK", per: "250g", status: "sold", color: "#EDE7D6", accent: "#2F5233", year: "2026" },
  { id: 14, r: "cc", name: "La Soledad", origin: "グアテマラ", process: "Washed", amount: 110, cur: "DKK", per: "250g", status: "archive", color: "#E2DBC8", accent: "#5A4632", year: "2022" },
  { id: 15, r: "onyx", name: "Hacienda La Esmeralda Geisha", origin: "パナマ", process: "Washed", amount: 62, cur: "USD", per: "100g", status: "now", color: "#EFE9DA", accent: "#3A2E4F", year: "2026", vt: "geisha" },
  { id: 16, r: "bibi", name: "Monteblanco Geisha", origin: "コロンビア", process: "Washed", amount: 3200, cur: "JPY", per: "100g", status: "now", color: "#F2EFE6", accent: "#2F5233", year: "2026", vt: "geisha" },
  { id: 17, r: "cc", name: "Ninety Plus Gesha", origin: "パナマ", process: "Natural", amount: 350, cur: "DKK", per: "100g", status: "sold", color: "#1C1B19", accent: "#D9B44A", year: "2026", vt: "geisha" },
  { id: 18, r: "tw", name: "Cerro Azul Geisha", origin: "コロンビア", process: "Natural", amount: 420, cur: "NOK", per: "100g", status: "now", color: "#E8E2D2", accent: "#8A3B2E", year: "2026", vt: "geisha" },
  { id: 19, r: "bibi", name: "Panama Geisha Lot 24", origin: "パナマ", process: "Natural", amount: 4500, cur: "JPY", per: "100g", status: "archive", color: "#B8433A", accent: "#F2E9DC", year: "2025", vt: "geisha" },
  { id: 20, r: "onyx", name: "Los Nogales Sidra", origin: "コロンビア", process: "Honey", amount: 30, cur: "USD", per: "100g", status: "now", color: "#4A5A3A", accent: "#EFE9DA", year: "2026", vt: "sidra" },
  { id: 21, r: "tw", name: "La Palma Sidra", origin: "コロンビア", process: "Washed", amount: 280, cur: "NOK", per: "100g", status: "now", color: "#F4F1E8", accent: "#4A5A3A", year: "2026", vt: "sidra" },
  { id: 22, r: "bibi", name: "Sidra Anaerobic", origin: "コロンビア", process: "Anaerobic", amount: 2800, cur: "JPY", per: "100g", status: "sold", color: "#2E2A24", accent: "#C8A96A", year: "2026", vt: "sidra" },
  { id: 23, r: "cc", name: "Finca Deveaux Sidra", origin: "エクアドル", process: "Washed", amount: 260, cur: "DKK", per: "100g", status: "archive", color: "#EDE7D6", accent: "#8A3B2E", year: "2025", vt: "sidra" },

  /* --- April Coffee (København) --- */
  { id: 24, r: "april", name: "Kayon Mountain", origin: "エチオピア", process: "Natural", amount: 145, cur: "DKK", per: "250g", status: "now", color: "#5A2E3A", accent: "#E8C8A0", year: "2026" },
  { id: 25, r: "april", name: "Bombe Bensa", origin: "エチオピア", process: "Natural", amount: 155, cur: "DKK", per: "250g", status: "now", color: "#7C2D3C", accent: "#F2E9DC", year: "2026" },
  { id: 26, r: "april", name: "El Tesoro Tabi", origin: "コロンビア", process: "Washed", amount: 160, cur: "DKK", per: "250g", status: "sold", color: "#EFE9DA", accent: "#8A3B2E", year: "2026" },
  { id: 27, r: "april", name: "Decaf de Caña", origin: "コロンビア", process: "Washed", amount: 130, cur: "DKK", per: "250g", status: "archive", color: "#E2DBC8", accent: "#5A4632", year: "2025" },

  /* --- GLITCH COFFEE (東京) --- */
  { id: 28, r: "glitch", name: "Hambela Alaka", origin: "エチオピア", process: "Natural", amount: 2400, cur: "JPY", per: "100g", status: "now", color: "#3A2E4F", accent: "#D9B44A", year: "2026" },
  { id: 29, r: "glitch", name: "Kirinyaga AA", origin: "ケニア", process: "Washed", amount: 2200, cur: "JPY", per: "100g", status: "now", color: "#B8433A", accent: "#F2E9DC", year: "2026" },
  { id: 30, r: "glitch", name: "El Diviso Geisha", origin: "コロンビア", process: "Washed", amount: 3800, cur: "JPY", per: "100g", status: "now", color: "#F2EFE6", accent: "#2F5233", year: "2026", vt: "geisha" },
  { id: 31, r: "glitch", name: "Gera Geisha", origin: "エチオピア", process: "Washed", amount: 4200, cur: "JPY", per: "100g", status: "sold", color: "#E8E2D2", accent: "#3A2E4F", year: "2026", vt: "geisha" },
  { id: 32, r: "glitch", name: "Elida Geisha", origin: "パナマ", process: "Natural", amount: 5000, cur: "JPY", per: "100g", status: "archive", color: "#2E2A24", accent: "#C8A96A", year: "2025", vt: "geisha" },

  /* --- Sey Coffee (Brooklyn) --- */
  { id: 33, r: "sey", name: "Nginda Estate", origin: "ケニア", process: "Washed", amount: 26, cur: "USD", per: "250g", status: "now", color: "#6B2D3C", accent: "#EFE9DA", year: "2026" },
  { id: 34, r: "sey", name: "El Diamante Chiroso", origin: "コロンビア", process: "Washed", amount: 25, cur: "USD", per: "250g", status: "now", color: "#F4F1E8", accent: "#8A3B2E", year: "2026" },
  { id: 35, r: "sey", name: "Buku Sayisa", origin: "エチオピア", process: "Washed", amount: 24, cur: "USD", per: "250g", status: "sold", color: "#EFE9DA", accent: "#2F5233", year: "2026" },
  { id: 36, r: "sey", name: "Guji Natural", origin: "エチオピア", process: "Natural", amount: 23, cur: "USD", per: "250g", status: "archive", color: "#3A2E4F", accent: "#D9B44A", year: "2025" },

  /* --- The Barn (Berlin) --- */
  { id: 37, r: "barn", name: "Kiangoi AA", origin: "ケニア", process: "Washed", amount: 16, cur: "EUR", per: "250g", status: "now", color: "#7C4D8F", accent: "#F2E9DC", year: "2026" },
  { id: 38, r: "barn", name: "Kabingara AB", origin: "ケニア", process: "Washed", amount: 15, cur: "EUR", per: "250g", status: "sold", color: "#B8433A", accent: "#F2E9DC", year: "2026" },
  { id: 39, r: "barn", name: "Sidama Natural", origin: "エチオピア", process: "Natural", amount: 15, cur: "EUR", per: "250g", status: "now", color: "#5A2E3A", accent: "#E8C8A0", year: "2026" },
  { id: 40, r: "barn", name: "Gesha Village", origin: "エチオピア", process: "Washed", amount: 45, cur: "EUR", per: "100g", status: "now", color: "#F2EFE6", accent: "#2F5233", year: "2026", vt: "geisha" },
  { id: 41, r: "barn", name: "El Vergel Washed", origin: "コロンビア", process: "Washed", amount: 17, cur: "EUR", per: "250g", status: "archive", color: "#E2DBC8", accent: "#5A4632", year: "2024" },

  /* --- Proud Mary (Melbourne) --- */
  { id: 42, r: "pm", name: "Guji Uraga", origin: "エチオピア", process: "Natural", amount: 24, cur: "AUD", per: "250g", status: "now", color: "#D97E3A", accent: "#2E2A24", year: "2026" },
  { id: 43, r: "pm", name: "La Cereza", origin: "コロンビア", process: "Washed", amount: 22, cur: "AUD", per: "250g", status: "now", color: "#EFE9DA", accent: "#6B2D3C", year: "2026" },
  { id: 44, r: "pm", name: "La Miel Geisha", origin: "コロンビア", process: "Natural", amount: 50, cur: "AUD", per: "100g", status: "sold", color: "#1C1B19", accent: "#D9B44A", year: "2026", vt: "geisha" },
  { id: 45, r: "pm", name: "El Tejar Sidra", origin: "コロンビア", process: "Washed", amount: 45, cur: "AUD", per: "100g", status: "now", color: "#4A5A3A", accent: "#EFE9DA", year: "2026", vt: "sidra" },
  { id: 46, r: "pm", name: "El Naranjo", origin: "グアテマラ", process: "Washed", amount: 23, cur: "AUD", per: "250g", status: "archive", color: "#E2DBC8", accent: "#5A4632", year: "2025" },

  /* --- La Cabra (Aarhus) --- */
  { id: 47, r: "lacabra", name: "Gogogu", origin: "エチオピア", process: "Washed", amount: 140, cur: "DKK", per: "250g", status: "now", color: "#EFE9DA", accent: "#D98CA6", year: "2026" },
  { id: 48, r: "lacabra", name: "Chelbesa", origin: "エチオピア", process: "Washed", amount: 135, cur: "DKK", per: "250g", status: "now", color: "#F2EFE6", accent: "#8A3B2E", year: "2026" },
  { id: 49, r: "lacabra", name: "Mustafa", origin: "コロンビア", process: "Washed", amount: 130, cur: "DKK", per: "250g", status: "sold", color: "#5A2E3A", accent: "#E8C8A0", year: "2026" },
  { id: 50, r: "lacabra", name: "Monkaaba", origin: "コロンビア", process: "Washed", amount: 145, cur: "DKK", per: "250g", status: "now", color: "#B8433A", accent: "#F2E9DC", year: "2026" },

  /* --- Manhattan Coffee (Rotterdam) --- */
  { id: 51, r: "manhattan", name: "Shoondhisa", origin: "エチオピア", process: "Natural", amount: 17, cur: "EUR", per: "250g", status: "now", color: "#7C2D3C", accent: "#F2E9DC", year: "2026" },
  { id: 52, r: "manhattan", name: "Los Patios Geisha", origin: "コロンビア", process: "Washed", amount: 29, cur: "EUR", per: "100g", status: "now", color: "#F2EFE6", accent: "#2F5233", year: "2026", vt: "geisha" },
  { id: 53, r: "manhattan", name: "Brooklyn", origin: "ブレンド", process: "Natural", amount: 13, cur: "EUR", per: "250g", status: "now", color: "#22303A", accent: "#C8792E", year: "2026" },
  { id: 54, r: "manhattan", name: "Kebena Decaf", origin: "エチオピア", process: "Washed", amount: 15, cur: "EUR", per: "250g", status: "archive", color: "#E2DBC8", accent: "#5A4632", year: "2025" },

  /* --- Fuglen Coffee (Oslo / 東京) --- */
  { id: 55, r: "fuglen", name: "Guji Shakiso", origin: "エチオピア", process: "Washed", amount: 175, cur: "NOK", per: "250g", status: "now", color: "#F4F1E8", accent: "#D98CA6", year: "2026" },
  { id: 56, r: "fuglen", name: "Nyeri Gichathaini", origin: "ケニア", process: "Washed", amount: 185, cur: "NOK", per: "250g", status: "sold", color: "#7C4D8F", accent: "#F2E9DC", year: "2026" },
  { id: 57, r: "fuglen", name: "Huila Pitalito", origin: "コロンビア", process: "Washed", amount: 165, cur: "NOK", per: "250g", status: "now", color: "#EFE9DA", accent: "#5A4632", year: "2026" },

  /* --- Kurasu (京都) --- */
  { id: 58, r: "kurasu", name: "Guji Natural", origin: "エチオピア", process: "Natural", amount: 1700, cur: "JPY", per: "100g", status: "now", color: "#6B2D3C", accent: "#EFE9DA", year: "2026" },
  { id: 59, r: "kurasu", name: "El Paraíso Lychee", origin: "コロンビア", process: "Anaerobic", amount: 2400, cur: "JPY", per: "100g", status: "now", color: "#D97E3A", accent: "#2E2A24", year: "2026" },
  { id: 60, r: "kurasu", name: "Cachoeira", origin: "ブラジル", process: "Natural", amount: 1500, cur: "JPY", per: "100g", status: "now", color: "#4A3826", accent: "#E8C8A0", year: "2026" },
  { id: 61, r: "kurasu", name: "Gatomboya AA", origin: "ケニア", process: "Washed", amount: 1900, cur: "JPY", per: "100g", status: "sold", color: "#B8433A", accent: "#F2E9DC", year: "2026" },

  /* --- Square Mile (London) --- */
  { id: 62, r: "sqmile", name: "Nano Challa", origin: "エチオピア", process: "Washed", amount: 13, cur: "GBP", per: "350g", status: "now", color: "#F2EFE6", accent: "#8A3B2E", year: "2026" },
  { id: 63, r: "sqmile", name: "Gatugi AA", origin: "ケニア", process: "Washed", amount: 14, cur: "GBP", per: "350g", status: "now", color: "#B8433A", accent: "#F2E9DC", year: "2026" },
  { id: 64, r: "sqmile", name: "Red Brick", origin: "ブレンド", process: "Washed / Natural", amount: 12, cur: "GBP", per: "350g", status: "now", color: "#7C2D3C", accent: "#E8C8A0", year: "2026" },
  { id: 65, r: "sqmile", name: "La Bendición", origin: "コロンビア", process: "Washed", amount: 13, cur: "GBP", per: "350g", status: "sold", color: "#EFE9DA", accent: "#5A4632", year: "2026" },

  /* --- Gardelli (Forlì) --- */
  { id: 66, r: "gardelli", name: "Konga Amederaro", origin: "エチオピア", process: "Natural", amount: 22, cur: "EUR", per: "250g", status: "now", color: "#3A2E4F", accent: "#D9B44A", year: "2026" },
  { id: 67, r: "gardelli", name: "La Argentina Geisha", origin: "コロンビア", process: "Washed", amount: 38, cur: "EUR", per: "100g", status: "now", color: "#F2EFE6", accent: "#2F5233", year: "2026", vt: "geisha" },
  { id: 68, r: "gardelli", name: "El Velo Geisha", origin: "パナマ", process: "Washed", amount: 55, cur: "EUR", per: "100g", status: "sold", color: "#E8E2D2", accent: "#3A2E4F", year: "2026", vt: "geisha" },
  { id: 69, r: "gardelli", name: "La Siria Geisha", origin: "コロンビア", process: "Honey", amount: 42, cur: "EUR", per: "100g", status: "archive", color: "#D97E3A", accent: "#2E2A24", year: "2025", vt: "geisha" },

  /* --- Onibus Coffee (東京) --- */
  { id: 70, r: "onibus", name: "Gakuyuini AA", origin: "ケニア", process: "Washed", amount: 1900, cur: "JPY", per: "150g", status: "now", color: "#7C4D8F", accent: "#F2E9DC", year: "2026" },
  { id: 71, r: "onibus", name: "La Bolsa Cipresales", origin: "グアテマラ", process: "Washed", amount: 1700, cur: "JPY", per: "150g", status: "now", color: "#EFE9DA", accent: "#5A4632", year: "2026" },
  { id: 72, r: "onibus", name: "Onibus Blend", origin: "ブレンド", process: "Natural", amount: 1400, cur: "JPY", per: "150g", status: "now", color: "#4A3826", accent: "#E8C8A0", year: "2026" },
  { id: 73, r: "onibus", name: "Konga", origin: "エチオピア", process: "Natural", amount: 1800, cur: "JPY", per: "150g", status: "sold", color: "#6B2D3C", accent: "#EFE9DA", year: "2026" },

  /* --- ONA Coffee (Canberra) --- */
  { id: 74, r: "ona", name: "Uraga", origin: "エチオピア", process: "Natural", amount: 26, cur: "AUD", per: "250g", status: "now", color: "#D97E3A", accent: "#2E2A24", year: "2026" },
  { id: 75, r: "ona", name: "El Diviso Geisha", origin: "コロンビア", process: "Natural", amount: 48, cur: "AUD", per: "100g", status: "now", color: "#1C1B19", accent: "#D9B44A", year: "2026", vt: "geisha" },
  { id: 76, r: "ona", name: "Ombligón", origin: "コロンビア", process: "Anaerobic", amount: 44, cur: "AUD", per: "100g", status: "now", color: "#4A5A3A", accent: "#EFE9DA", year: "2026", vt: "sidra" },
  { id: 77, r: "ona", name: "Elida Geisha", origin: "パナマ", process: "Washed", amount: 60, cur: "AUD", per: "100g", status: "archive", color: "#2E2A24", accent: "#C8A96A", year: "2025", vt: "geisha" },

  { id: 78, r: "koppi", name: "Chelchele", origin: "エチオピア", process: "Washed", amount: 165, cur: "SEK", per: "250g", status: "now", color: "#F2EFE6", accent: "#8A3B2E", year: "2026" },
  { id: 79, r: "koppi", name: "Thikagiki AB", origin: "ケニア", process: "Washed", amount: 180, cur: "SEK", per: "250g", status: "now", color: "#3A2E4F", accent: "#D9B44A", year: "2026" },
  { id: 80, r: "koppi", name: "Nariño", origin: "コロンビア", process: "Washed", amount: 160, cur: "SEK", per: "250g", status: "sold", color: "#B8433A", accent: "#F2E9DC", year: "2026" },
  { id: 81, r: "drop", name: "Idido", origin: "エチオピア", process: "Washed", amount: 175, cur: "SEK", per: "250g", status: "now", color: "#EFE9DA", accent: "#2F5233", year: "2026" },
  { id: 82, r: "drop", name: "Kirinyaga", origin: "ケニア", process: "Washed", amount: 185, cur: "SEK", per: "250g", status: "now", color: "#5A2E3A", accent: "#E8C8A0", year: "2026" },
  { id: 83, r: "drop", name: "Enano", origin: "コロンビア", process: "Washed", amount: 165, cur: "SEK", per: "250g", status: "sold", color: "#7C4D8F", accent: "#F2E9DC", year: "2026" },
  { id: 84, r: "morgon", name: "Guji", origin: "エチオピア", process: "Natural", amount: 180, cur: "SEK", per: "250g", status: "now", color: "#22303A", accent: "#C8792E", year: "2026" },
  { id: 85, r: "morgon", name: "Kamwangi", origin: "ケニア", process: "Washed", amount: 190, cur: "SEK", per: "250g", status: "now", color: "#E2DBC8", accent: "#5A4632", year: "2026" },
  { id: 86, r: "prolog", name: "Chelchele Organic", origin: "エチオピア", process: "Washed", amount: 145, cur: "DKK", per: "250g", status: "now", color: "#6B2D3C", accent: "#EFE9DA", year: "2026" },
  { id: 87, r: "prolog", name: "Nariño", origin: "コロンビア", process: "Washed", amount: 150, cur: "DKK", per: "250g", status: "now", color: "#4A5A3A", accent: "#EFE9DA", year: "2026" },
  { id: 88, r: "prolog", name: "Costa Rica La Pastora", origin: "コスタリカ", process: "Honey", amount: 155, cur: "DKK", per: "250g", status: "sold", color: "#D97E3A", accent: "#2E2A24", year: "2026" },
  { id: 89, r: "friedhats", name: "Idido", origin: "エチオピア", process: "Natural", amount: 16, cur: "EUR", per: "250g", status: "now", color: "#2E2A24", accent: "#C8A96A", year: "2026" },
  { id: 90, r: "friedhats", name: "Gaturiri", origin: "ケニア", process: "Washed", amount: 17, cur: "EUR", per: "250g", status: "sold", color: "#F4F1E8", accent: "#1A1815", year: "2026" },
  { id: 91, r: "dak", name: "Buku Abel", origin: "エチオピア", process: "Natural", amount: 18, cur: "EUR", per: "250g", status: "now", color: "#1C1B19", accent: "#E8E2D2", year: "2026" },
  { id: 92, r: "dak", name: "El Vergel Geisha", origin: "コロンビア", process: "Washed", amount: 34, cur: "EUR", per: "100g", status: "now", color: "#F2EFE6", accent: "#8A3B2E", year: "2026", vt: "geisha" },
  { id: 93, r: "dak", name: "Honeymoon", origin: "コロンビア", process: "Washed", amount: 19, cur: "EUR", per: "250g", status: "sold", color: "#3A2E4F", accent: "#D9B44A", year: "2026" },
  { id: 94, r: "bonanza", name: "Kayon Mountain", origin: "エチオピア", process: "Natural", amount: 16, cur: "EUR", per: "250g", status: "now", color: "#B8433A", accent: "#F2E9DC", year: "2026" },
  { id: 95, r: "bonanza", name: "Colombia Geisha", origin: "コロンビア", process: "Washed", amount: 32, cur: "EUR", per: "100g", status: "now", color: "#EFE9DA", accent: "#2F5233", year: "2026", vt: "geisha" },
  { id: 96, r: "fiveele", name: "Queen of Sheba", origin: "エチオピア", process: "Washed", amount: 17, cur: "EUR", per: "250g", status: "now", color: "#5A2E3A", accent: "#E8C8A0", year: "2026" },
  { id: 97, r: "fiveele", name: "Kello Siko", origin: "エチオピア", process: "Washed", amount: 16, cur: "EUR", per: "250g", status: "now", color: "#7C4D8F", accent: "#F2E9DC", year: "2026" },
  { id: 98, r: "fiveele", name: "Duromina", origin: "エチオピア", process: "Washed", amount: 16, cur: "EUR", per: "250g", status: "sold", color: "#22303A", accent: "#C8792E", year: "2026" },
  { id: 99, r: "nomad", name: "Sidama", origin: "エチオピア", process: "Washed", amount: 15, cur: "EUR", per: "250g", status: "now", color: "#E2DBC8", accent: "#5A4632", year: "2026" },
  { id: 100, r: "nomad", name: "Huila", origin: "コロンビア", process: "Washed", amount: 14, cur: "EUR", per: "250g", status: "now", color: "#6B2D3C", accent: "#EFE9DA", year: "2026" },
  { id: 101, r: "assembly", name: "Rumudamo Natural", origin: "エチオピア", process: "Natural", amount: 13, cur: "GBP", per: "250g", status: "now", color: "#4A5A3A", accent: "#EFE9DA", year: "2026" },
  { id: 102, r: "assembly", name: "Bookkisa", origin: "エチオピア", process: "Washed", amount: 12, cur: "GBP", per: "250g", status: "now", color: "#D97E3A", accent: "#2E2A24", year: "2026" },
  { id: 103, r: "assembly", name: "House Selection", origin: "ブレンド", process: "Washed / Natural", amount: 11, cur: "GBP", per: "250g", status: "now", color: "#2E2A24", accent: "#C8A96A", year: "2026" },
  { id: 104, r: "colonna", name: "Yirgacheffe", origin: "エチオピア", process: "Washed", amount: 13, cur: "GBP", per: "250g", status: "now", color: "#F4F1E8", accent: "#1A1815", year: "2026" },
  { id: 105, r: "colonna", name: "Kirinyaga", origin: "ケニア", process: "Washed", amount: 14, cur: "GBP", per: "250g", status: "sold", color: "#1C1B19", accent: "#E8E2D2", year: "2026" },
  { id: 106, r: "roundhill", name: "Fazenda Rainha", origin: "ブラジル", process: "Natural", amount: 11, cur: "GBP", per: "250g", status: "now", color: "#F2EFE6", accent: "#8A3B2E", year: "2026" },
  { id: 107, r: "roundhill", name: "Guji", origin: "エチオピア", process: "Washed", amount: 12, cur: "GBP", per: "250g", status: "now", color: "#3A2E4F", accent: "#D9B44A", year: "2026" },
  { id: 108, r: "howell", name: "Borboya", origin: "エチオピア", process: "Washed", amount: 23, cur: "USD", per: "250g", status: "now", color: "#B8433A", accent: "#F2E9DC", year: "2026" },
  { id: 109, r: "howell", name: "Kenya Gaturiri", origin: "ケニア", process: "Washed", amount: 24, cur: "USD", per: "250g", status: "now", color: "#EFE9DA", accent: "#2F5233", year: "2026" },
  { id: 110, r: "howell", name: "La Bella Guatemala", origin: "グアテマラ", process: "Washed", amount: 22, cur: "USD", per: "250g", status: "sold", color: "#5A2E3A", accent: "#E8C8A0", year: "2026" },
  { id: 111, r: "heart", name: "Gerba Dogo Sodu", origin: "エチオピア", process: "Washed", amount: 22, cur: "USD", per: "250g", status: "now", color: "#7C4D8F", accent: "#F2E9DC", year: "2026" },
  { id: 112, r: "heart", name: "Santa Mónica", origin: "コロンビア", process: "Washed", amount: 21, cur: "USD", per: "250g", status: "now", color: "#22303A", accent: "#C8792E", year: "2026" },
  { id: 113, r: "heart", name: "Kenya Karani", origin: "ケニア", process: "Washed", amount: 23, cur: "USD", per: "250g", status: "sold", color: "#E2DBC8", accent: "#5A4632", year: "2026" },
  { id: 114, r: "coava", name: "Suke Quto", origin: "エチオピア", process: "Washed", amount: 20, cur: "USD", per: "250g", status: "now", color: "#6B2D3C", accent: "#EFE9DA", year: "2026" },
  { id: 115, r: "coava", name: "La Esperanza", origin: "コロンビア", process: "Washed", amount: 21, cur: "USD", per: "250g", status: "now", color: "#4A5A3A", accent: "#EFE9DA", year: "2026" },
  { id: 116, r: "passenger", name: "Guji Natural", origin: "エチオピア", process: "Natural", amount: 21, cur: "USD", per: "250g", status: "now", color: "#D97E3A", accent: "#2E2A24", year: "2026" },
  { id: 117, r: "passenger", name: "El Placer", origin: "コロンビア", process: "Washed", amount: 20, cur: "USD", per: "250g", status: "now", color: "#2E2A24", accent: "#C8A96A", year: "2026" },
  { id: 118, r: "bw", name: "Aricha", origin: "エチオピア", process: "Washed", amount: 21, cur: "USD", per: "250g", status: "now", color: "#F4F1E8", accent: "#1A1815", year: "2026" },
  { id: 119, r: "bw", name: "The Classic", origin: "ブレンド", process: "Washed", amount: 18, cur: "USD", per: "250g", status: "now", color: "#1C1B19", accent: "#E8E2D2", year: "2026" },
  { id: 120, r: "bw", name: "Las Nubes", origin: "コロンビア", process: "Washed", amount: 20, cur: "USD", per: "250g", status: "sold", color: "#F2EFE6", accent: "#8A3B2E", year: "2026" },
  { id: 121, r: "verve", name: "Streetlevel", origin: "ブレンド", process: "Washed", amount: 19, cur: "USD", per: "250g", status: "now", color: "#3A2E4F", accent: "#D9B44A", year: "2026" },
  { id: 122, r: "verve", name: "Sidama", origin: "エチオピア", process: "Washed", amount: 22, cur: "USD", per: "250g", status: "now", color: "#B8433A", accent: "#F2E9DC", year: "2026" },
  { id: 123, r: "verve", name: "Buena Vista", origin: "コロンビア", process: "Natural", amount: 21, cur: "USD", per: "250g", status: "sold", color: "#EFE9DA", accent: "#2F5233", year: "2026" },
  { id: 124, r: "prodigal", name: "Las Perlitas", origin: "コロンビア", process: "Washed", amount: 26, cur: "USD", per: "250g", status: "now", color: "#5A2E3A", accent: "#E8C8A0", year: "2026" },
  { id: 125, r: "prodigal", name: "Shantawene", origin: "エチオピア", process: "Natural", amount: 27, cur: "USD", per: "250g", status: "now", color: "#7C4D8F", accent: "#F2E9DC", year: "2026" },
  { id: 126, r: "ruby", name: "Guji", origin: "エチオピア", process: "Natural", amount: 22, cur: "USD", per: "250g", status: "now", color: "#22303A", accent: "#C8792E", year: "2026" },
  { id: 127, r: "ruby", name: "El Paraíso", origin: "コロンビア", process: "Washed", amount: 21, cur: "USD", per: "250g", status: "sold", color: "#E2DBC8", accent: "#5A4632", year: "2026" },
  { id: 128, r: "stumptown", name: "Hair Bender", origin: "ブレンド", process: "Washed / Natural", amount: 18, cur: "USD", per: "340g", status: "now", color: "#6B2D3C", accent: "#EFE9DA", year: "2026" },
  { id: 129, r: "stumptown", name: "Guji", origin: "エチオピア", process: "Washed", amount: 20, cur: "USD", per: "340g", status: "now", color: "#4A5A3A", accent: "#EFE9DA", year: "2026" },
  { id: 130, r: "stumptown", name: "El Jardín", origin: "コロンビア", process: "Washed", amount: 19, cur: "USD", per: "340g", status: "sold", color: "#D97E3A", accent: "#2E2A24", year: "2026" },
  { id: 131, r: "philseb", name: "Chelbesa", origin: "エチオピア", process: "Washed", amount: 26, cur: "CAD", per: "250g", status: "now", color: "#2E2A24", accent: "#C8A96A", year: "2026" },
  { id: 132, r: "philseb", name: "Las Margaritas", origin: "コロンビア", process: "Washed", amount: 25, cur: "CAD", per: "250g", status: "now", color: "#F4F1E8", accent: "#1A1815", year: "2026" },
  { id: 133, r: "philseb", name: "Kirinyaga", origin: "ケニア", process: "Washed", amount: 27, cur: "CAD", per: "250g", status: "sold", color: "#1C1B19", accent: "#E8E2D2", year: "2026" },
  { id: 134, r: "p49", name: "Idido Natural", origin: "エチオピア", process: "Natural", amount: 24, cur: "CAD", per: "250g", status: "now", color: "#F2EFE6", accent: "#8A3B2E", year: "2026" },
  { id: 135, r: "p49", name: "Inzá", origin: "コロンビア", process: "Washed", amount: 23, cur: "CAD", per: "250g", status: "now", color: "#3A2E4F", accent: "#D9B44A", year: "2026" },
  { id: 136, r: "marketlane", name: "Yirgacheffe", origin: "エチオピア", process: "Washed", amount: 24, cur: "AUD", per: "250g", status: "now", color: "#B8433A", accent: "#F2E9DC", year: "2026" },
  { id: 137, r: "marketlane", name: "El Meridiano", origin: "コロンビア", process: "Washed", amount: 23, cur: "AUD", per: "250g", status: "now", color: "#EFE9DA", accent: "#2F5233", year: "2026" },
  { id: 138, r: "marketlane", name: "Nyeri", origin: "ケニア", process: "Washed", amount: 25, cur: "AUD", per: "250g", status: "sold", color: "#5A2E3A", accent: "#E8C8A0", year: "2026" },
  { id: 139, r: "smallbatch", name: "Candyman", origin: "ブレンド", process: "Washed / Natural", amount: 21, cur: "AUD", per: "250g", status: "now", color: "#7C4D8F", accent: "#F2E9DC", year: "2026" },
  { id: 140, r: "smallbatch", name: "Sidama Natural", origin: "エチオピア", process: "Natural", amount: 24, cur: "AUD", per: "250g", status: "now", color: "#22303A", accent: "#C8792E", year: "2026" },
  { id: 141, r: "axil", name: "Guji", origin: "エチオピア", process: "Washed", amount: 23, cur: "AUD", per: "250g", status: "now", color: "#E2DBC8", accent: "#5A4632", year: "2026" },
  { id: 142, r: "axil", name: "El Placer Honey", origin: "コロンビア", process: "Honey", amount: 24, cur: "AUD", per: "250g", status: "now", color: "#6B2D3C", accent: "#EFE9DA", year: "2026" },
  { id: 143, r: "supreme", name: "Nyamyumba", origin: "ルワンダ", process: "Washed", amount: 24, cur: "NZD", per: "250g", status: "now", color: "#4A5A3A", accent: "#EFE9DA", year: "2026" },
  { id: 144, r: "supreme", name: "Cauca", origin: "コロンビア", process: "Washed", amount: 23, cur: "NZD", per: "250g", status: "now", color: "#D97E3A", accent: "#2E2A24", year: "2026" },
  { id: 145, r: "supreme", name: "Big Joe", origin: "ブレンド", process: "Washed", amount: 22, cur: "NZD", per: "250g", status: "now", color: "#2E2A24", accent: "#C8A96A", year: "2026" },
  { id: 146, r: "flight", name: "Guji Natural", origin: "エチオピア", process: "Natural", amount: 25, cur: "NZD", per: "250g", status: "now", color: "#F4F1E8", accent: "#1A1815", year: "2026" },
  { id: 147, r: "flight", name: "Tolima", origin: "コロンビア", process: "Washed", amount: 24, cur: "NZD", per: "250g", status: "sold", color: "#1C1B19", accent: "#E8E2D2", year: "2026" },
  { id: 148, r: "philo", name: "Tokyo Blend 011", origin: "ブレンド", process: "Washed / Natural", amount: 1600, cur: "JPY", per: "100g", status: "now", color: "#F2EFE6", accent: "#8A3B2E", year: "2026" },
  { id: 149, r: "philo", name: "Yirgacheffe", origin: "エチオピア", process: "Washed", amount: 1800, cur: "JPY", per: "100g", status: "now", color: "#3A2E4F", accent: "#D9B44A", year: "2026" },
  { id: 150, r: "philo", name: "El Paraíso Lychee", origin: "コロンビア", process: "Anaerobic", amount: 2600, cur: "JPY", per: "100g", status: "now", color: "#B8433A", accent: "#F2E9DC", year: "2026" },
  { id: 151, r: "leaves", name: "Guji Natural", origin: "エチオピア", process: "Natural", amount: 1900, cur: "JPY", per: "100g", status: "now", color: "#EFE9DA", accent: "#2F5233", year: "2026" },
  { id: 152, r: "leaves", name: "Nyeri AA", origin: "ケニア", process: "Washed", amount: 2000, cur: "JPY", per: "100g", status: "now", color: "#5A2E3A", accent: "#E8C8A0", year: "2026" },
  { id: 153, r: "lightup", name: "Yirgacheffe", origin: "エチオピア", process: "Washed", amount: 1500, cur: "JPY", per: "100g", status: "now", color: "#7C4D8F", accent: "#F2E9DC", year: "2026" },
  { id: 154, r: "lightup", name: "Antigua", origin: "グアテマラ", process: "Washed", amount: 1600, cur: "JPY", per: "100g", status: "sold", color: "#22303A", accent: "#C8792E", year: "2026" },
  { id: 155, r: "county", name: "Guji Natural", origin: "エチオピア", process: "Natural", amount: 1600, cur: "JPY", per: "100g", status: "now", color: "#E2DBC8", accent: "#5A4632", year: "2026" },
  { id: 156, r: "county", name: "La Bolsa", origin: "グアテマラ", process: "Washed", amount: 1700, cur: "JPY", per: "100g", status: "now", color: "#6B2D3C", accent: "#EFE9DA", year: "2026" },
  { id: 157, r: "nylon", name: "Kamiro", origin: "ルワンダ", process: "Washed", amount: 24, cur: "SGD", per: "250g", status: "now", color: "#4A5A3A", accent: "#EFE9DA", year: "2026" },
  { id: 158, r: "nylon", name: "Alejandro Ahumada", origin: "コロンビア", process: "Washed", amount: 25, cur: "SGD", per: "250g", status: "now", color: "#D97E3A", accent: "#2E2A24", year: "2026" },
  { id: 159, r: "nylon", name: "Four Chairs", origin: "ブレンド", process: "Washed", amount: 22, cur: "SGD", per: "250g", status: "now", color: "#2E2A24", accent: "#C8A96A", year: "2026" },

  { id: 160, r: "standout", name: "Ethiopia Aricha", origin: "エチオピア", process: "Natural", amount: 175, cur: "SEK", per: "250g", status: "now", color: "#F2EFE6", accent: "#8A3B2E", year: "2026" },
  { id: 161, r: "standout", name: "Gesha Especial", origin: "コロンビア", process: "Washed", amount: 320, cur: "SEK", per: "100g", status: "now", color: "#3A2E4F", accent: "#D9B44A", year: "2026", vt: "geisha" },
  { id: 162, r: "damatteo", name: "Yirgacheffe", origin: "エチオピア", process: "Washed", amount: 175, cur: "SEK", per: "250g", status: "now", color: "#B8433A", accent: "#F2E9DC", year: "2026" },
  { id: 163, r: "damatteo", name: "Kirinyaga AA", origin: "ケニア", process: "Washed", amount: 175, cur: "SEK", per: "250g", status: "sold", color: "#EFE9DA", accent: "#2F5233", year: "2026" },
  { id: 164, r: "johannystrom", name: "Ljus Etiopien", origin: "エチオピア", process: "Washed", amount: 175, cur: "SEK", per: "250g", status: "now", color: "#5A2E3A", accent: "#E8C8A0", year: "2026" },
  { id: 165, r: "johannystrom", name: "Colombia Huila", origin: "コロンビア", process: "Washed", amount: 175, cur: "SEK", per: "250g", status: "now", color: "#7C4D8F", accent: "#F2E9DC", year: "2026" },
  { id: 166, r: "solberghansen", name: "Guji", origin: "エチオピア", process: "Natural", amount: 180, cur: "NOK", per: "250g", status: "now", color: "#22303A", accent: "#C8792E", year: "2026" },
  { id: 167, r: "solberghansen", name: "Nyeri", origin: "ケニア", process: "Washed", amount: 180, cur: "NOK", per: "250g", status: "now", color: "#E2DBC8", accent: "#5A4632", year: "2026" },
  { id: 168, r: "talorjorgen", name: "Idido", origin: "エチオピア", process: "Washed", amount: 180, cur: "NOK", per: "250g", status: "now", color: "#6B2D3C", accent: "#EFE9DA", year: "2026" },
  { id: 169, r: "talorjorgen", name: "El Diviso", origin: "コロンビア", process: "Washed", amount: 180, cur: "NOK", per: "250g", status: "sold", color: "#4A5A3A", accent: "#EFE9DA", year: "2026" },
  { id: 170, r: "andersenmaillard", name: "Chelchele", origin: "エチオピア", process: "Washed", amount: 145, cur: "DKK", per: "250g", status: "now", color: "#D97E3A", accent: "#2E2A24", year: "2026" },
  { id: 171, r: "andersenmaillard", name: "Las Flores", origin: "コロンビア", process: "Washed", amount: 145, cur: "DKK", per: "250g", status: "now", color: "#2E2A24", accent: "#C8A96A", year: "2026" },
  { id: 172, r: "lot61", name: "Ethiopia Guji", origin: "エチオピア", process: "Natural", amount: 16, cur: "EUR", per: "250g", status: "now", color: "#F4F1E8", accent: "#1A1815", year: "2026" },
  { id: 173, r: "lot61", name: "Fazenda Rainha", origin: "ブラジル", process: "Natural", amount: 16, cur: "EUR", per: "250g", status: "now", color: "#1C1B19", accent: "#E8E2D2", year: "2026" },
  { id: 174, r: "bocca", name: "Yirgacheffe", origin: "エチオピア", process: "Washed", amount: 16, cur: "EUR", per: "250g", status: "now", color: "#F2EFE6", accent: "#8A3B2E", year: "2026" },
  { id: 175, r: "bocca", name: "Colombia Nariño", origin: "コロンビア", process: "Washed", amount: 16, cur: "EUR", per: "250g", status: "sold", color: "#3A2E4F", accent: "#D9B44A", year: "2026" },
  { id: 176, r: "manvsmachine", name: "Sidama", origin: "エチオピア", process: "Washed", amount: 16, cur: "EUR", per: "250g", status: "now", color: "#B8433A", accent: "#F2E9DC", year: "2026" },
  { id: 177, r: "manvsmachine", name: "Kenya Kiambu", origin: "ケニア", process: "Washed", amount: 16, cur: "EUR", per: "250g", status: "now", color: "#EFE9DA", accent: "#2F5233", year: "2026" },
  { id: 178, r: "elbgold", name: "Ethiopia Guji", origin: "エチオピア", process: "Natural", amount: 16, cur: "EUR", per: "250g", status: "now", color: "#5A2E3A", accent: "#E8C8A0", year: "2026" },
  { id: 179, r: "elbgold", name: "Colombia Tolima", origin: "コロンビア", process: "Washed", amount: 16, cur: "EUR", per: "250g", status: "now", color: "#7C4D8F", accent: "#F2E9DC", year: "2026" },
  { id: 180, r: "grams", name: "Ethiopia Reko", origin: "エチオピア", process: "Washed", amount: 16, cur: "EUR", per: "250g", status: "now", color: "#22303A", accent: "#C8792E", year: "2026" },
  { id: 181, r: "grams", name: "El Vergel", origin: "コロンビア", process: "Washed", amount: 16, cur: "EUR", per: "250g", status: "sold", color: "#E2DBC8", accent: "#5A4632", year: "2026" },
  { id: 182, r: "rightside", name: "Ethiopia Hambela", origin: "エチオピア", process: "Natural", amount: 16, cur: "EUR", per: "250g", status: "now", color: "#6B2D3C", accent: "#EFE9DA", year: "2026" },
  { id: 183, r: "rightside", name: "Colombia Geisha", origin: "コロンビア", process: "Washed", amount: 34, cur: "EUR", per: "100g", status: "now", color: "#4A5A3A", accent: "#EFE9DA", year: "2026", vt: "geisha" },
  { id: 184, r: "hola", name: "Ethiopia Sidama", origin: "エチオピア", process: "Washed", amount: 16, cur: "EUR", per: "250g", status: "now", color: "#D97E3A", accent: "#2E2A24", year: "2026" },
  { id: 185, r: "hola", name: "Colombia Cauca", origin: "コロンビア", process: "Washed", amount: 16, cur: "EUR", per: "250g", status: "now", color: "#2E2A24", accent: "#C8A96A", year: "2026" },
  { id: 186, r: "elmagnifico", name: "Ethiopia Yirga", origin: "エチオピア", process: "Washed", amount: 16, cur: "EUR", per: "250g", status: "now", color: "#F4F1E8", accent: "#1A1815", year: "2026" },
  { id: 187, r: "elmagnifico", name: "Guatemala Huehue", origin: "グアテマラ", process: "Washed", amount: 16, cur: "EUR", per: "250g", status: "sold", color: "#1C1B19", accent: "#E8E2D2", year: "2026" },
  { id: 188, r: "workshop", name: "Ethiopia Guji", origin: "エチオピア", process: "Washed", amount: 13, cur: "GBP", per: "250g", status: "now", color: "#F2EFE6", accent: "#8A3B2E", year: "2026" },
  { id: 189, r: "workshop", name: "Colombia Popayán", origin: "コロンビア", process: "Washed", amount: 13, cur: "GBP", per: "250g", status: "now", color: "#3A2E4F", accent: "#D9B44A", year: "2026" },
  { id: 190, r: "origincoffee", name: "Ethiopia Wolde", origin: "エチオピア", process: "Washed", amount: 13, cur: "GBP", per: "250g", status: "now", color: "#B8433A", accent: "#F2E9DC", year: "2026" },
  { id: 191, r: "origincoffee", name: "Las Cochas", origin: "コロンビア", process: "Washed", amount: 13, cur: "GBP", per: "250g", status: "now", color: "#EFE9DA", accent: "#2F5233", year: "2026" },
  { id: 192, r: "caravan", name: "Ethiopia Sidama", origin: "エチオピア", process: "Natural", amount: 13, cur: "GBP", per: "250g", status: "now", color: "#5A2E3A", accent: "#E8C8A0", year: "2026" },
  { id: 193, r: "caravan", name: "Colombia Huila", origin: "コロンビア", process: "Washed", amount: 13, cur: "GBP", per: "250g", status: "sold", color: "#7C4D8F", accent: "#F2E9DC", year: "2026" },
  { id: 194, r: "ozone", name: "Ethiopia Guji", origin: "エチオピア", process: "Washed", amount: 13, cur: "GBP", per: "250g", status: "now", color: "#22303A", accent: "#C8792E", year: "2026" },
  { id: 195, r: "ozone", name: "Kenya Nyeri", origin: "ケニア", process: "Washed", amount: 13, cur: "GBP", per: "250g", status: "now", color: "#E2DBC8", accent: "#5A4632", year: "2026" },
  { id: 196, r: "kissthehippo", name: "Ethiopia Kayon", origin: "エチオピア", process: "Natural", amount: 13, cur: "GBP", per: "250g", status: "now", color: "#6B2D3C", accent: "#EFE9DA", year: "2026" },
  { id: 197, r: "kissthehippo", name: "El Paraíso", origin: "コロンビア", process: "Anaerobic", amount: 13, cur: "GBP", per: "250g", status: "now", color: "#4A5A3A", accent: "#EFE9DA", year: "2026" },
  { id: 198, r: "intelligentsia", name: "Frequency Blend", origin: "ブレンド", process: "Washed", amount: 22, cur: "USD", per: "250g", status: "now", color: "#D97E3A", accent: "#2E2A24", year: "2026" },
  { id: 199, r: "intelligentsia", name: "Ethiopia Kurimi", origin: "エチオピア", process: "Washed", amount: 22, cur: "USD", per: "250g", status: "now", color: "#2E2A24", accent: "#C8A96A", year: "2026" },
  { id: 200, r: "counterculture", name: "Hologram", origin: "ブレンド", process: "Washed", amount: 22, cur: "USD", per: "250g", status: "now", color: "#F4F1E8", accent: "#1A1815", year: "2026" },
  { id: 201, r: "counterculture", name: "Idido", origin: "エチオピア", process: "Washed", amount: 22, cur: "USD", per: "250g", status: "sold", color: "#1C1B19", accent: "#E8E2D2", year: "2026" },
  { id: 202, r: "bluebottle", name: "Three Africas", origin: "ブレンド", process: "Washed", amount: 22, cur: "USD", per: "250g", status: "now", color: "#F2EFE6", accent: "#8A3B2E", year: "2026" },
  { id: 203, r: "bluebottle", name: "Nano Challa", origin: "エチオピア", process: "Washed", amount: 22, cur: "USD", per: "250g", status: "now", color: "#3A2E4F", accent: "#D9B44A", year: "2026" },
  { id: 204, r: "sightglass", name: "Owl's Howl", origin: "ブレンド", process: "Washed", amount: 22, cur: "USD", per: "250g", status: "now", color: "#B8433A", accent: "#F2E9DC", year: "2026" },
  { id: 205, r: "sightglass", name: "Ethiopia Guji", origin: "エチオピア", process: "Natural", amount: 22, cur: "USD", per: "250g", status: "now", color: "#EFE9DA", accent: "#2F5233", year: "2026" },
  { id: 206, r: "wreckingball", name: "Ethiopia Reko", origin: "エチオピア", process: "Washed", amount: 22, cur: "USD", per: "250g", status: "now", color: "#5A2E3A", accent: "#E8C8A0", year: "2026" },
  { id: 207, r: "wreckingball", name: "Colombia Nariño", origin: "コロンビア", process: "Washed", amount: 22, cur: "USD", per: "250g", status: "sold", color: "#7C4D8F", accent: "#F2E9DC", year: "2026" },
  { id: 208, r: "equator", name: "Tigerwalk", origin: "ブレンド", process: "Washed", amount: 22, cur: "USD", per: "250g", status: "now", color: "#22303A", accent: "#C8792E", year: "2026" },
  { id: 209, r: "equator", name: "Ethiopia Yirga", origin: "エチオピア", process: "Washed", amount: 22, cur: "USD", per: "250g", status: "now", color: "#E2DBC8", accent: "#5A4632", year: "2026" },
  { id: 210, r: "sweetbloom", name: "Hometown", origin: "ブレンド", process: "Washed", amount: 22, cur: "USD", per: "250g", status: "now", color: "#6B2D3C", accent: "#EFE9DA", year: "2026" },
  { id: 211, r: "sweetbloom", name: "Ethiopia Hambela", origin: "エチオピア", process: "Natural", amount: 22, cur: "USD", per: "250g", status: "now", color: "#4A5A3A", accent: "#EFE9DA", year: "2026" },
  { id: 212, r: "corvus", name: "Ethiopia Guji", origin: "エチオピア", process: "Natural", amount: 22, cur: "USD", per: "250g", status: "now", color: "#D97E3A", accent: "#2E2A24", year: "2026" },
  { id: 213, r: "corvus", name: "Colombia Sidra", origin: "コロンビア", process: "Washed", amount: 37, cur: "USD", per: "100g", status: "now", color: "#2E2A24", accent: "#C8A96A", year: "2026", vt: "sidra" },
  { id: 214, r: "methodical", name: "Ethiopia Yirga", origin: "エチオピア", process: "Washed", amount: 22, cur: "USD", per: "250g", status: "now", color: "#F4F1E8", accent: "#1A1815", year: "2026" },
  { id: 215, r: "methodical", name: "El Placer", origin: "コロンビア", process: "Washed", amount: 22, cur: "USD", per: "250g", status: "sold", color: "#1C1B19", accent: "#E8E2D2", year: "2026" },
  { id: 216, r: "tandem", name: "Time & Temperature", origin: "ブレンド", process: "Washed", amount: 22, cur: "USD", per: "250g", status: "now", color: "#F2EFE6", accent: "#8A3B2E", year: "2026" },
  { id: 217, r: "tandem", name: "Ethiopia Sidama", origin: "エチオピア", process: "Natural", amount: 22, cur: "USD", per: "250g", status: "now", color: "#3A2E4F", accent: "#D9B44A", year: "2026" },
  { id: 218, r: "madcap", name: "Third Coast", origin: "ブレンド", process: "Washed", amount: 22, cur: "USD", per: "250g", status: "now", color: "#B8433A", accent: "#F2E9DC", year: "2026" },
  { id: 219, r: "madcap", name: "Ethiopia Guji", origin: "エチオピア", process: "Washed", amount: 22, cur: "USD", per: "250g", status: "now", color: "#EFE9DA", accent: "#2F5233", year: "2026" },
  { id: 220, r: "temple", name: "Ethiopia Guji", origin: "エチオピア", process: "Natural", amount: 22, cur: "USD", per: "250g", status: "now", color: "#5A2E3A", accent: "#E8C8A0", year: "2026" },
  { id: 221, r: "temple", name: "Colombia Huila", origin: "コロンビア", process: "Washed", amount: 22, cur: "USD", per: "250g", status: "sold", color: "#7C4D8F", accent: "#F2E9DC", year: "2026" },
  { id: 222, r: "camber", name: "Ethiopia Sidama", origin: "エチオピア", process: "Washed", amount: 22, cur: "USD", per: "250g", status: "now", color: "#22303A", accent: "#C8792E", year: "2026" },
  { id: 223, r: "camber", name: "Kenya Nyeri", origin: "ケニア", process: "Washed", amount: 22, cur: "USD", per: "250g", status: "now", color: "#E2DBC8", accent: "#5A4632", year: "2026" },
  { id: 224, r: "pilot", name: "Heritage Blend", origin: "ブレンド", process: "Washed", amount: 25, cur: "CAD", per: "250g", status: "now", color: "#6B2D3C", accent: "#EFE9DA", year: "2026" },
  { id: 225, r: "pilot", name: "Ethiopia Yirga", origin: "エチオピア", process: "Washed", amount: 25, cur: "CAD", per: "250g", status: "now", color: "#4A5A3A", accent: "#EFE9DA", year: "2026" },
  { id: 226, r: "rosso", name: "Carmen Caturra", origin: "コスタリカ", process: "Washed", amount: 25, cur: "CAD", per: "250g", status: "now", color: "#D97E3A", accent: "#2E2A24", year: "2026" },
  { id: 227, r: "rosso", name: "Ethiopia Guji", origin: "エチオピア", process: "Natural", amount: 25, cur: "CAD", per: "250g", status: "sold", color: "#2E2A24", accent: "#C8A96A", year: "2026" },
  { id: 228, r: "singleo", name: "Killerbee", origin: "ブレンド", process: "Washed", amount: 24, cur: "AUD", per: "250g", status: "now", color: "#F4F1E8", accent: "#1A1815", year: "2026" },
  { id: 229, r: "singleo", name: "Ethiopia Wolde", origin: "エチオピア", process: "Washed", amount: 24, cur: "AUD", per: "250g", status: "now", color: "#1C1B19", accent: "#E8E2D2", year: "2026" },
  { id: 230, r: "sevenseeds", name: "Golden Gate", origin: "ブレンド", process: "Washed", amount: 24, cur: "AUD", per: "250g", status: "now", color: "#F2EFE6", accent: "#8A3B2E", year: "2026" },
  { id: 231, r: "sevenseeds", name: "Ethiopia Guji", origin: "エチオピア", process: "Natural", amount: 24, cur: "AUD", per: "250g", status: "now", color: "#3A2E4F", accent: "#D9B44A", year: "2026" },
  { id: 232, r: "padre", name: "The Daydream", origin: "ブレンド", process: "Washed", amount: 24, cur: "AUD", per: "250g", status: "now", color: "#B8433A", accent: "#F2E9DC", year: "2026" },
  { id: 233, r: "padre", name: "Ethiopia Sidama", origin: "エチオピア", process: "Natural", amount: 24, cur: "AUD", per: "250g", status: "sold", color: "#EFE9DA", accent: "#2F5233", year: "2026" },
  { id: 234, r: "mecca", name: "Kingpin", origin: "ブレンド", process: "Washed", amount: 24, cur: "AUD", per: "250g", status: "now", color: "#5A2E3A", accent: "#E8C8A0", year: "2026" },
  { id: 235, r: "mecca", name: "Ethiopia Yirga", origin: "エチオピア", process: "Washed", amount: 24, cur: "AUD", per: "250g", status: "now", color: "#7C4D8F", accent: "#F2E9DC", year: "2026" },
  { id: 236, r: "allpress", name: "Redchurch", origin: "ブレンド", process: "Washed", amount: 24, cur: "NZD", per: "250g", status: "now", color: "#22303A", accent: "#C8792E", year: "2026" },
  { id: 237, r: "allpress", name: "Ethiopia Guji", origin: "エチオピア", process: "Washed", amount: 24, cur: "NZD", per: "250g", status: "now", color: "#E2DBC8", accent: "#5A4632", year: "2026" },
  { id: 238, r: "arabica", name: "% Blend", origin: "ブレンド", process: "Washed", amount: 1800, cur: "JPY", per: "100g", status: "now", color: "#6B2D3C", accent: "#EFE9DA", year: "2026" },
  { id: 239, r: "arabica", name: "Ethiopia Guji", origin: "エチオピア", process: "Natural", amount: 1800, cur: "JPY", per: "100g", status: "now", color: "#4A5A3A", accent: "#EFE9DA", year: "2026" },
  { id: 240, r: "arabica", name: "Panama Geisha", origin: "パナマ", process: "Washed", amount: 3800, cur: "JPY", per: "100g", status: "sold", color: "#D97E3A", accent: "#2E2A24", year: "2026", vt: "geisha" },
  { id: 241, r: "maruyama", name: "Ethiopia Mordecofe", origin: "エチオピア", process: "Washed", amount: 1800, cur: "JPY", per: "100g", status: "now", color: "#2E2A24", accent: "#C8A96A", year: "2026" },
  { id: 242, r: "maruyama", name: "Geisha Auromar", origin: "パナマ", process: "Natural", amount: 3800, cur: "JPY", per: "100g", status: "now", color: "#F4F1E8", accent: "#1A1815", year: "2026", vt: "geisha" },
  { id: 243, r: "switch", name: "Ethiopia Guji", origin: "エチオピア", process: "Natural", amount: 1800, cur: "JPY", per: "100g", status: "now", color: "#1C1B19", accent: "#E8E2D2", year: "2026" },
  { id: 244, r: "switch", name: "El Paraíso", origin: "コロンビア", process: "Anaerobic", amount: 1800, cur: "JPY", per: "100g", status: "now", color: "#F2EFE6", accent: "#8A3B2E", year: "2026" },
  { id: 245, r: "woodberry", name: "Ethiopia Yirga", origin: "エチオピア", process: "Washed", amount: 1800, cur: "JPY", per: "100g", status: "now", color: "#3A2E4F", accent: "#D9B44A", year: "2026" },
  { id: 246, r: "woodberry", name: "Colombia Huila", origin: "コロンビア", process: "Washed", amount: 1800, cur: "JPY", per: "100g", status: "sold", color: "#B8433A", accent: "#F2E9DC", year: "2026" },
  { id: 247, r: "rec", name: "Ethiopia Sidama", origin: "エチオピア", process: "Natural", amount: 1800, cur: "JPY", per: "100g", status: "now", color: "#EFE9DA", accent: "#2F5233", year: "2026" },
  { id: 248, r: "rec", name: "Guatemala Antigua", origin: "グアテマラ", process: "Washed", amount: 1800, cur: "JPY", per: "100g", status: "now", color: "#5A2E3A", accent: "#E8C8A0", year: "2026" },
  { id: 249, r: "trunk", name: "Ethiopia Guji", origin: "エチオピア", process: "Washed", amount: 1800, cur: "JPY", per: "100g", status: "now", color: "#7C4D8F", accent: "#F2E9DC", year: "2026" },
  { id: 250, r: "trunk", name: "Colombia Nariño", origin: "コロンビア", process: "Washed", amount: 1800, cur: "JPY", per: "100g", status: "now", color: "#22303A", accent: "#C8792E", year: "2026" },
  { id: 251, r: "nozy", name: "Ethiopia Yirga", origin: "エチオピア", process: "Natural", amount: 1800, cur: "JPY", per: "100g", status: "now", color: "#E2DBC8", accent: "#5A4632", year: "2026" },
  { id: 252, r: "nozy", name: "Fazenda Brazil", origin: "ブラジル", process: "Natural", amount: 1800, cur: "JPY", per: "100g", status: "sold", color: "#6B2D3C", accent: "#EFE9DA", year: "2026" },
  { id: 253, r: "horiguchi", name: "Ethiopia Mocha", origin: "エチオピア", process: "Natural", amount: 1800, cur: "JPY", per: "100g", status: "now", color: "#4A5A3A", accent: "#EFE9DA", year: "2026" },
  { id: 254, r: "horiguchi", name: "Guatemala Antigua", origin: "グアテマラ", process: "Washed", amount: 1800, cur: "JPY", per: "100g", status: "now", color: "#D97E3A", accent: "#2E2A24", year: "2026" },
  { id: 255, r: "threemarks", name: "Ethiopia Hambela", origin: "エチオピア", process: "Natural", amount: 16, cur: "EUR", per: "250g", status: "now", color: "#2E2A24", accent: "#C8A96A", year: "2026" },
  { id: 256, r: "threemarks", name: "El Diviso", origin: "コロンビア", process: "Washed", amount: 16, cur: "EUR", per: "250g", status: "now", color: "#F4F1E8", accent: "#1A1815", year: "2026" },
  { id: 257, r: "rocketbean", name: "Ethiopia Guji", origin: "エチオピア", process: "Natural", amount: 16, cur: "EUR", per: "250g", status: "now", color: "#1C1B19", accent: "#E8E2D2", year: "2026" },
  { id: 258, r: "rocketbean", name: "Colombia Huila", origin: "コロンビア", process: "Washed", amount: 16, cur: "EUR", per: "250g", status: "sold", color: "#F2EFE6", accent: "#8A3B2E", year: "2026" },
  { id: 259, r: "ppp", name: "Terra Espresso", origin: "ブレンド", process: "Washed", amount: 24, cur: "SGD", per: "250g", status: "now", color: "#3A2E4F", accent: "#D9B44A", year: "2026" },
  { id: 260, r: "ppp", name: "Ethiopia Yirga", origin: "エチオピア", process: "Washed", amount: 24, cur: "SGD", per: "250g", status: "now", color: "#B8433A", accent: "#F2E9DC", year: "2026" },
  { id: 261, r: "supremerw", name: "Ethiopia Guji", origin: "エチオピア", process: "Natural", amount: 180, cur: "NOK", per: "250g", status: "now", color: "#F2EFE6", accent: "#8A3B2E", year: "2026" },
  { id: 262, r: "supremerw", name: "Colombia Huila", origin: "コロンビア", process: "Washed", amount: 180, cur: "NOK", per: "250g", status: "sold", color: "#3A2E4F", accent: "#D9B44A", year: "2026" },
  { id: 263, r: "kaffaoslo", name: "Ethiopia Yirgacheffe", origin: "エチオピア", process: "Washed", amount: 180, cur: "NOK", per: "250g", status: "now", color: "#B8433A", accent: "#F2E9DC", year: "2026" },
  { id: 264, r: "kaffaoslo", name: "Kenya Kirinyaga", origin: "ケニア", process: "Washed", amount: 180, cur: "NOK", per: "250g", status: "now", color: "#EFE9DA", accent: "#2F5233", year: "2026" },
  { id: 265, r: "kaffebrenneriet", name: "Ethiopia Sidama", origin: "エチオピア", process: "Natural", amount: 180, cur: "NOK", per: "250g", status: "now", color: "#5A2E3A", accent: "#E8C8A0", year: "2026" },
  { id: 266, r: "kaffebrenneriet", name: "Brazil Fazenda Rainha", origin: "ブラジル", process: "Natural", amount: 180, cur: "NOK", per: "250g", status: "now", color: "#7C4D8F", accent: "#F2E9DC", year: "2026" },
  { id: 267, r: "jacu", name: "Ethiopia Hambela", origin: "エチオピア", process: "Washed", amount: 180, cur: "NOK", per: "250g", status: "now", color: "#22303A", accent: "#C8792E", year: "2026" },
  { id: 268, r: "jacu", name: "Guatemala Huehuetenango", origin: "グアテマラ", process: "Washed", amount: 180, cur: "NOK", per: "250g", status: "sold", color: "#E2DBC8", accent: "#5A4632", year: "2026" },
  { id: 269, r: "langora", name: "Ethiopia Chelchele", origin: "エチオピア", process: "Natural", amount: 180, cur: "NOK", per: "250g", status: "now", color: "#6B2D3C", accent: "#EFE9DA", year: "2026" },
  { id: 270, r: "langora", name: "Colombia Popayán", origin: "コロンビア", process: "Washed", amount: 180, cur: "NOK", per: "250g", status: "now", color: "#4A5A3A", accent: "#EFE9DA", year: "2026" },
  { id: 271, r: "talormade", name: "Ethiopia Wolde", origin: "エチオピア", process: "Washed", amount: 180, cur: "NOK", per: "250g", status: "now", color: "#D97E3A", accent: "#2E2A24", year: "2026" },
  { id: 272, r: "talormade", name: "Kenya Kirinyaga", origin: "ケニア", process: "Washed", amount: 180, cur: "NOK", per: "250g", status: "now", color: "#2E2A24", accent: "#C8A96A", year: "2026" },
  { id: 273, r: "lippe", name: "Ethiopia Reko", origin: "エチオピア", process: "Natural", amount: 180, cur: "NOK", per: "250g", status: "now", color: "#F4F1E8", accent: "#1A1815", year: "2026" },
  { id: 274, r: "lippe", name: "Brazil Cerrado", origin: "ブラジル", process: "Natural", amount: 180, cur: "NOK", per: "250g", status: "sold", color: "#1C1B19", accent: "#E8E2D2", year: "2026" },
  { id: 275, r: "kaffemisjonen", name: "Ethiopia Aricha", origin: "エチオピア", process: "Washed", amount: 180, cur: "NOK", per: "250g", status: "now", color: "#F2EFE6", accent: "#8A3B2E", year: "2026" },
  { id: 276, r: "kaffemisjonen", name: "Guatemala Antigua", origin: "グアテマラ", process: "Washed", amount: 180, cur: "NOK", per: "250g", status: "now", color: "#3A2E4F", accent: "#D9B44A", year: "2026" },
  { id: 277, r: "detlille", name: "Ethiopia Guji", origin: "エチオピア", process: "Natural", amount: 180, cur: "NOK", per: "250g", status: "now", color: "#B8433A", accent: "#F2E9DC", year: "2026" },
  { id: 278, r: "detlille", name: "Colombia Tolima", origin: "コロンビア", process: "Washed", amount: 180, cur: "NOK", per: "250g", status: "now", color: "#EFE9DA", accent: "#2F5233", year: "2026" },
  { id: 279, r: "jacobsensvart", name: "Ethiopia Yirgacheffe", origin: "エチオピア", process: "Washed", amount: 180, cur: "NOK", per: "250g", status: "now", color: "#5A2E3A", accent: "#E8C8A0", year: "2026" },
  { id: 280, r: "jacobsensvart", name: "Kenya Kirinyaga", origin: "ケニア", process: "Washed", amount: 180, cur: "NOK", per: "250g", status: "sold", color: "#7C4D8F", accent: "#F2E9DC", year: "2026" },
  { id: 281, r: "boenner", name: "Ethiopia Sidama", origin: "エチオピア", process: "Natural", amount: 180, cur: "NOK", per: "250g", status: "now", color: "#22303A", accent: "#C8792E", year: "2026" },
  { id: 282, r: "boenner", name: "Brazil Mogiana", origin: "ブラジル", process: "Natural", amount: 180, cur: "NOK", per: "250g", status: "now", color: "#E2DBC8", accent: "#5A4632", year: "2026" },
  { id: 283, r: "java", name: "Ethiopia Hambela", origin: "エチオピア", process: "Washed", amount: 180, cur: "NOK", per: "250g", status: "now", color: "#6B2D3C", accent: "#EFE9DA", year: "2026" },
  { id: 284, r: "java", name: "Guatemala Acatenango", origin: "グアテマラ", process: "Washed", amount: 180, cur: "NOK", per: "250g", status: "now", color: "#4A5A3A", accent: "#EFE9DA", year: "2026" },
  { id: 285, r: "lykke", name: "Ethiopia Chelchele", origin: "エチオピア", process: "Natural", amount: 175, cur: "SEK", per: "250g", status: "now", color: "#D97E3A", accent: "#2E2A24", year: "2026" },
  { id: 286, r: "lykke", name: "Colombia Cauca", origin: "コロンビア", process: "Washed", amount: 175, cur: "SEK", per: "250g", status: "sold", color: "#2E2A24", accent: "#C8A96A", year: "2026" },
  { id: 287, r: "solde", name: "Ethiopia Wolde", origin: "エチオピア", process: "Washed", amount: 175, cur: "SEK", per: "250g", status: "now", color: "#F4F1E8", accent: "#1A1815", year: "2026" },
  { id: 288, r: "solde", name: "Kenya Kirinyaga", origin: "ケニア", process: "Washed", amount: 175, cur: "SEK", per: "250g", status: "now", color: "#1C1B19", accent: "#E8E2D2", year: "2026" },
  { id: 289, r: "gringo", name: "Ethiopia Reko", origin: "エチオピア", process: "Natural", amount: 175, cur: "SEK", per: "250g", status: "now", color: "#F2EFE6", accent: "#8A3B2E", year: "2026" },
  { id: 290, r: "gringo", name: "Brazil Fazenda Rainha", origin: "ブラジル", process: "Natural", amount: 175, cur: "SEK", per: "250g", status: "now", color: "#3A2E4F", accent: "#D9B44A", year: "2026" },
  { id: 291, r: "kafferaven", name: "Ethiopia Aricha", origin: "エチオピア", process: "Washed", amount: 175, cur: "SEK", per: "250g", status: "now", color: "#B8433A", accent: "#F2E9DC", year: "2026" },
  { id: 292, r: "kafferaven", name: "Guatemala Huehuetenango", origin: "グアテマラ", process: "Washed", amount: 175, cur: "SEK", per: "250g", status: "sold", color: "#EFE9DA", accent: "#2F5233", year: "2026" },
  { id: 293, r: "stockholmroast", name: "Ethiopia Guji", origin: "エチオピア", process: "Natural", amount: 175, cur: "SEK", per: "250g", status: "now", color: "#5A2E3A", accent: "#E8C8A0", year: "2026" },
  { id: 294, r: "stockholmroast", name: "Colombia Nariño", origin: "コロンビア", process: "Washed", amount: 175, cur: "SEK", per: "250g", status: "now", color: "#7C4D8F", accent: "#F2E9DC", year: "2026" },
  { id: 295, r: "kaffelabbet", name: "Ethiopia Yirgacheffe", origin: "エチオピア", process: "Washed", amount: 175, cur: "SEK", per: "250g", status: "now", color: "#22303A", accent: "#C8792E", year: "2026" },
  { id: 296, r: "kaffelabbet", name: "Kenya Kirinyaga", origin: "ケニア", process: "Washed", amount: 175, cur: "SEK", per: "250g", status: "now", color: "#E2DBC8", accent: "#5A4632", year: "2026" },
  { id: 297, r: "kaffekaross", name: "Ethiopia Sidama", origin: "エチオピア", process: "Natural", amount: 175, cur: "SEK", per: "250g", status: "now", color: "#6B2D3C", accent: "#EFE9DA", year: "2026" },
  { id: 298, r: "kaffekaross", name: "Brazil Cerrado", origin: "ブラジル", process: "Natural", amount: 175, cur: "SEK", per: "250g", status: "sold", color: "#4A5A3A", accent: "#EFE9DA", year: "2026" },
  { id: 299, r: "animakaffe", name: "Ethiopia Hambela", origin: "エチオピア", process: "Washed", amount: 175, cur: "SEK", per: "250g", status: "now", color: "#D97E3A", accent: "#2E2A24", year: "2026" },
  { id: 300, r: "animakaffe", name: "Guatemala Antigua", origin: "グアテマラ", process: "Washed", amount: 175, cur: "SEK", per: "250g", status: "now", color: "#2E2A24", accent: "#C8A96A", year: "2026" },
  { id: 301, r: "kontra", name: "Ethiopia Chelchele", origin: "エチオピア", process: "Natural", amount: 145, cur: "DKK", per: "250g", status: "now", color: "#F4F1E8", accent: "#1A1815", year: "2026" },
  { id: 302, r: "kontra", name: "Colombia Huila", origin: "コロンビア", process: "Washed", amount: 145, cur: "DKK", per: "250g", status: "now", color: "#1C1B19", accent: "#E8E2D2", year: "2026" },
  { id: 303, r: "greatcoffee", name: "Ethiopia Wolde", origin: "エチオピア", process: "Washed", amount: 145, cur: "DKK", per: "250g", status: "now", color: "#F2EFE6", accent: "#8A3B2E", year: "2026" },
  { id: 304, r: "greatcoffee", name: "Kenya Kirinyaga", origin: "ケニア", process: "Washed", amount: 145, cur: "DKK", per: "250g", status: "sold", color: "#3A2E4F", accent: "#D9B44A", year: "2026" },
  { id: 305, r: "impact", name: "Ethiopia Reko", origin: "エチオピア", process: "Natural", amount: 145, cur: "DKK", per: "250g", status: "now", color: "#B8433A", accent: "#F2E9DC", year: "2026" },
  { id: 306, r: "impact", name: "Brazil Mogiana", origin: "ブラジル", process: "Natural", amount: 145, cur: "DKK", per: "250g", status: "now", color: "#EFE9DA", accent: "#2F5233", year: "2026" },
  { id: 307, r: "democratic", name: "Ethiopia Aricha", origin: "エチオピア", process: "Washed", amount: 145, cur: "DKK", per: "250g", status: "now", color: "#5A2E3A", accent: "#E8C8A0", year: "2026" },
  { id: 308, r: "democratic", name: "Guatemala Acatenango", origin: "グアテマラ", process: "Washed", amount: 145, cur: "DKK", per: "250g", status: "now", color: "#7C4D8F", accent: "#F2E9DC", year: "2026" },
  { id: 309, r: "cphcoffeelab", name: "Ethiopia Guji", origin: "エチオピア", process: "Natural", amount: 145, cur: "DKK", per: "250g", status: "now", color: "#22303A", accent: "#C8792E", year: "2026" },
  { id: 310, r: "cphcoffeelab", name: "Colombia Popayán", origin: "コロンビア", process: "Washed", amount: 145, cur: "DKK", per: "250g", status: "sold", color: "#E2DBC8", accent: "#5A4632", year: "2026" },
  { id: 311, r: "original", name: "Ethiopia Yirgacheffe", origin: "エチオピア", process: "Washed", amount: 145, cur: "DKK", per: "250g", status: "now", color: "#6B2D3C", accent: "#EFE9DA", year: "2026" },
  { id: 312, r: "original", name: "Kenya Kirinyaga", origin: "ケニア", process: "Washed", amount: 145, cur: "DKK", per: "250g", status: "now", color: "#4A5A3A", accent: "#EFE9DA", year: "2026" },
  { id: 313, r: "risteriet", name: "Ethiopia Sidama", origin: "エチオピア", process: "Natural", amount: 145, cur: "DKK", per: "250g", status: "now", color: "#D97E3A", accent: "#2E2A24", year: "2026" },
  { id: 314, r: "risteriet", name: "Brazil Fazenda Rainha", origin: "ブラジル", process: "Natural", amount: 145, cur: "DKK", per: "250g", status: "now", color: "#2E2A24", accent: "#C8A96A", year: "2026" },
  { id: 315, r: "kaffa", name: "Ethiopia Hambela", origin: "エチオピア", process: "Washed", amount: 16, cur: "EUR", per: "250g", status: "now", color: "#F4F1E8", accent: "#1A1815", year: "2026" },
  { id: 316, r: "kaffa", name: "Guatemala Huehuetenango", origin: "グアテマラ", process: "Washed", amount: 16, cur: "EUR", per: "250g", status: "sold", color: "#1C1B19", accent: "#E8E2D2", year: "2026" },
  { id: 317, r: "goodlife", name: "Ethiopia Chelchele", origin: "エチオピア", process: "Natural", amount: 16, cur: "EUR", per: "250g", status: "now", color: "#F2EFE6", accent: "#8A3B2E", year: "2026" },
  { id: 318, r: "goodlife", name: "Colombia Tolima", origin: "コロンビア", process: "Washed", amount: 16, cur: "EUR", per: "250g", status: "now", color: "#3A2E4F", accent: "#D9B44A", year: "2026" },
  { id: 319, r: "lehmus", name: "Ethiopia Wolde", origin: "エチオピア", process: "Washed", amount: 16, cur: "EUR", per: "250g", status: "now", color: "#B8433A", accent: "#F2E9DC", year: "2026" },
  { id: 320, r: "lehmus", name: "Kenya Kirinyaga", origin: "ケニア", process: "Washed", amount: 16, cur: "EUR", per: "250g", status: "now", color: "#EFE9DA", accent: "#2F5233", year: "2026" },
  { id: 321, r: "papu", name: "Ethiopia Reko", origin: "エチオピア", process: "Natural", amount: 16, cur: "EUR", per: "250g", status: "now", color: "#5A2E3A", accent: "#E8C8A0", year: "2026" },
  { id: 322, r: "papu", name: "Brazil Cerrado", origin: "ブラジル", process: "Natural", amount: 16, cur: "EUR", per: "250g", status: "sold", color: "#7C4D8F", accent: "#F2E9DC", year: "2026" },
  { id: 323, r: "turun", name: "Ethiopia Aricha", origin: "エチオピア", process: "Washed", amount: 16, cur: "EUR", per: "250g", status: "now", color: "#22303A", accent: "#C8792E", year: "2026" },
  { id: 324, r: "turun", name: "Guatemala Antigua", origin: "グアテマラ", process: "Washed", amount: 16, cur: "EUR", per: "250g", status: "now", color: "#E2DBC8", accent: "#5A4632", year: "2026" },
  { id: 325, r: "cafetoria", name: "Ethiopia Guji", origin: "エチオピア", process: "Natural", amount: 16, cur: "EUR", per: "250g", status: "now", color: "#6B2D3C", accent: "#EFE9DA", year: "2026" },
  { id: 326, r: "cafetoria", name: "Colombia Cauca", origin: "コロンビア", process: "Washed", amount: 16, cur: "EUR", per: "250g", status: "now", color: "#4A5A3A", accent: "#EFE9DA", year: "2026" },
  { id: 327, r: "helsinkiroastery", name: "Ethiopia Yirgacheffe", origin: "エチオピア", process: "Washed", amount: 16, cur: "EUR", per: "250g", status: "now", color: "#D97E3A", accent: "#2E2A24", year: "2026" },
  { id: 328, r: "helsinkiroastery", name: "Kenya Kirinyaga", origin: "ケニア", process: "Washed", amount: 16, cur: "EUR", per: "250g", status: "sold", color: "#2E2A24", accent: "#C8A96A", year: "2026" },
  { id: 329, r: "kahiwa", name: "Ethiopia Sidama", origin: "エチオピア", process: "Natural", amount: 16, cur: "EUR", per: "250g", status: "now", color: "#F4F1E8", accent: "#1A1815", year: "2026" },
  { id: 330, r: "kahiwa", name: "Brazil Mogiana", origin: "ブラジル", process: "Natural", amount: 16, cur: "EUR", per: "250g", status: "now", color: "#1C1B19", accent: "#E8E2D2", year: "2026" },
  { id: 331, r: "mokkamestarit", name: "Ethiopia Hambela", origin: "エチオピア", process: "Washed", amount: 16, cur: "EUR", per: "250g", status: "now", color: "#F2EFE6", accent: "#8A3B2E", year: "2026" },
  { id: 332, r: "mokkamestarit", name: "Guatemala Acatenango", origin: "グアテマラ", process: "Washed", amount: 16, cur: "EUR", per: "250g", status: "now", color: "#3A2E4F", accent: "#D9B44A", year: "2026" },
  { id: 333, r: "record", name: "Ethiopia Chelchele", origin: "エチオピア", process: "Natural", amount: 16, cur: "EUR", per: "250g", status: "now", color: "#B8433A", accent: "#F2E9DC", year: "2026" },
  { id: 334, r: "record", name: "Colombia Nariño", origin: "コロンビア", process: "Washed", amount: 16, cur: "EUR", per: "250g", status: "sold", color: "#EFE9DA", accent: "#2F5233", year: "2026" },
  { id: 335, r: "reykjavik", name: "Ethiopia Wolde", origin: "エチオピア", process: "Washed", amount: 2400, cur: "ISK", per: "250g", status: "now", color: "#5A2E3A", accent: "#E8C8A0", year: "2026" },
  { id: 336, r: "reykjavik", name: "Kenya Kirinyaga", origin: "ケニア", process: "Washed", amount: 2400, cur: "ISK", per: "250g", status: "now", color: "#7C4D8F", accent: "#F2E9DC", year: "2026" },
  { id: 337, r: "kaffitar", name: "Ethiopia Reko", origin: "エチオピア", process: "Natural", amount: 2400, cur: "ISK", per: "250g", status: "now", color: "#22303A", accent: "#C8792E", year: "2026" },
  { id: 338, r: "kaffitar", name: "Brazil Fazenda Rainha", origin: "ブラジル", process: "Natural", amount: 2400, cur: "ISK", per: "250g", status: "now", color: "#E2DBC8", accent: "#5A4632", year: "2026" },
  { id: 339, r: "teogkaffi", name: "Ethiopia Aricha", origin: "エチオピア", process: "Washed", amount: 2400, cur: "ISK", per: "250g", status: "now", color: "#6B2D3C", accent: "#EFE9DA", year: "2026" },
  { id: 340, r: "teogkaffi", name: "Guatemala Huehuetenango", origin: "グアテマラ", process: "Washed", amount: 2400, cur: "ISK", per: "250g", status: "sold", color: "#4A5A3A", accent: "#EFE9DA", year: "2026" },
  { id: 341, r: "kuma", name: "Ethiopia Guji", origin: "エチオピア", process: "Natural", amount: 22, cur: "USD", per: "250g", status: "now", color: "#D97E3A", accent: "#2E2A24", year: "2026" },
  { id: 342, r: "kuma", name: "Colombia Huila", origin: "コロンビア", process: "Washed", amount: 22, cur: "USD", per: "250g", status: "now", color: "#2E2A24", accent: "#C8A96A", year: "2026" },
  { id: 343, r: "elm", name: "Ethiopia Yirgacheffe", origin: "エチオピア", process: "Washed", amount: 22, cur: "USD", per: "250g", status: "now", color: "#F4F1E8", accent: "#1A1815", year: "2026" },
  { id: 344, r: "elm", name: "Kenya Kirinyaga", origin: "ケニア", process: "Washed", amount: 22, cur: "USD", per: "250g", status: "now", color: "#1C1B19", accent: "#E8E2D2", year: "2026" },
  { id: 345, r: "herkimer", name: "Ethiopia Sidama", origin: "エチオピア", process: "Natural", amount: 22, cur: "USD", per: "250g", status: "now", color: "#F2EFE6", accent: "#8A3B2E", year: "2026" },
  { id: 346, r: "herkimer", name: "Brazil Cerrado", origin: "ブラジル", process: "Natural", amount: 22, cur: "USD", per: "250g", status: "sold", color: "#3A2E4F", accent: "#D9B44A", year: "2026" },
  { id: 347, r: "victrola", name: "Ethiopia Hambela", origin: "エチオピア", process: "Washed", amount: 22, cur: "USD", per: "250g", status: "now", color: "#B8433A", accent: "#F2E9DC", year: "2026" },
  { id: 348, r: "victrola", name: "Guatemala Antigua", origin: "グアテマラ", process: "Washed", amount: 22, cur: "USD", per: "250g", status: "now", color: "#EFE9DA", accent: "#2F5233", year: "2026" },
  { id: 349, r: "dune", name: "Ethiopia Chelchele", origin: "エチオピア", process: "Natural", amount: 22, cur: "USD", per: "250g", status: "now", color: "#5A2E3A", accent: "#E8C8A0", year: "2026" },
  { id: 350, r: "dune", name: "Colombia Popayán", origin: "コロンビア", process: "Washed", amount: 22, cur: "USD", per: "250g", status: "now", color: "#7C4D8F", accent: "#F2E9DC", year: "2026" },
  { id: 351, r: "portrait", name: "Ethiopia Wolde", origin: "エチオピア", process: "Washed", amount: 22, cur: "USD", per: "250g", status: "now", color: "#22303A", accent: "#C8792E", year: "2026" },
  { id: 352, r: "portrait", name: "Kenya Kirinyaga", origin: "ケニア", process: "Washed", amount: 22, cur: "USD", per: "250g", status: "sold", color: "#E2DBC8", accent: "#5A4632", year: "2026" },
  { id: 353, r: "portrait", name: "Portrait Geisha", origin: "コロンビア", process: "Washed", amount: 30, cur: "USD", per: "100g", status: "now", color: "#6B2D3C", accent: "#EFE9DA", year: "2026", vt: "geisha" },
  { id: 354, r: "littlewolf", name: "Ethiopia Reko", origin: "エチオピア", process: "Natural", amount: 22, cur: "USD", per: "250g", status: "now", color: "#4A5A3A", accent: "#EFE9DA", year: "2026" },
  { id: 355, r: "littlewolf", name: "Brazil Mogiana", origin: "ブラジル", process: "Natural", amount: 22, cur: "USD", per: "250g", status: "now", color: "#D97E3A", accent: "#2E2A24", year: "2026" },
  { id: 356, r: "broadsheet", name: "Ethiopia Aricha", origin: "エチオピア", process: "Washed", amount: 22, cur: "USD", per: "250g", status: "now", color: "#2E2A24", accent: "#C8A96A", year: "2026" },
  { id: 357, r: "broadsheet", name: "Guatemala Acatenango", origin: "グアテマラ", process: "Washed", amount: 22, cur: "USD", per: "250g", status: "now", color: "#F4F1E8", accent: "#1A1815", year: "2026" },
  { id: 358, r: "speedwell", name: "Ethiopia Guji", origin: "エチオピア", process: "Natural", amount: 22, cur: "USD", per: "250g", status: "now", color: "#1C1B19", accent: "#E8E2D2", year: "2026" },
  { id: 359, r: "speedwell", name: "Colombia Tolima", origin: "コロンビア", process: "Washed", amount: 22, cur: "USD", per: "250g", status: "sold", color: "#F2EFE6", accent: "#8A3B2E", year: "2026" },
  { id: 360, r: "slate", name: "Ethiopia Yirgacheffe", origin: "エチオピア", process: "Washed", amount: 22, cur: "USD", per: "250g", status: "now", color: "#3A2E4F", accent: "#D9B44A", year: "2026" },
  { id: 361, r: "slate", name: "Kenya Kirinyaga", origin: "ケニア", process: "Washed", amount: 22, cur: "USD", per: "250g", status: "now", color: "#B8433A", accent: "#F2E9DC", year: "2026" },
  { id: 362, r: "demello", name: "Ethiopia Sidama", origin: "エチオピア", process: "Natural", amount: 25, cur: "CAD", per: "250g", status: "now", color: "#EFE9DA", accent: "#2F5233", year: "2026" },
  { id: 363, r: "demello", name: "Brazil Fazenda Rainha", origin: "ブラジル", process: "Natural", amount: 25, cur: "CAD", per: "250g", status: "now", color: "#5A2E3A", accent: "#E8C8A0", year: "2026" },
  { id: 364, r: "monogram", name: "Ethiopia Hambela", origin: "エチオピア", process: "Washed", amount: 25, cur: "CAD", per: "250g", status: "now", color: "#7C4D8F", accent: "#F2E9DC", year: "2026" },
  { id: 365, r: "monogram", name: "Guatemala Huehuetenango", origin: "グアテマラ", process: "Washed", amount: 25, cur: "CAD", per: "250g", status: "sold", color: "#22303A", accent: "#C8792E", year: "2026" },
  { id: 366, r: "subtext", name: "Ethiopia Chelchele", origin: "エチオピア", process: "Natural", amount: 25, cur: "CAD", per: "250g", status: "now", color: "#E2DBC8", accent: "#5A4632", year: "2026" },
  { id: 367, r: "subtext", name: "Colombia Cauca", origin: "コロンビア", process: "Washed", amount: 25, cur: "CAD", per: "250g", status: "now", color: "#6B2D3C", accent: "#EFE9DA", year: "2026" },
  { id: 368, r: "extract", name: "Ethiopia Wolde", origin: "エチオピア", process: "Washed", amount: 13, cur: "GBP", per: "250g", status: "now", color: "#4A5A3A", accent: "#EFE9DA", year: "2026" },
  { id: 369, r: "extract", name: "Kenya Kirinyaga", origin: "ケニア", process: "Washed", amount: 13, cur: "GBP", per: "250g", status: "now", color: "#D97E3A", accent: "#2E2A24", year: "2026" },
  { id: 370, r: "cliftoncoffee", name: "Ethiopia Reko", origin: "エチオピア", process: "Natural", amount: 13, cur: "GBP", per: "250g", status: "now", color: "#2E2A24", accent: "#C8A96A", year: "2026" },
  { id: 371, r: "cliftoncoffee", name: "Brazil Cerrado", origin: "ブラジル", process: "Natural", amount: 13, cur: "GBP", per: "250g", status: "sold", color: "#F4F1E8", accent: "#1A1815", year: "2026" },
  { id: 372, r: "northstar", name: "Ethiopia Aricha", origin: "エチオピア", process: "Washed", amount: 13, cur: "GBP", per: "250g", status: "now", color: "#1C1B19", accent: "#E8E2D2", year: "2026" },
  { id: 373, r: "northstar", name: "Guatemala Antigua", origin: "グアテマラ", process: "Washed", amount: 13, cur: "GBP", per: "250g", status: "now", color: "#F2EFE6", accent: "#8A3B2E", year: "2026" },
  { id: 374, r: "foundry", name: "Ethiopia Guji", origin: "エチオピア", process: "Natural", amount: 13, cur: "GBP", per: "250g", status: "now", color: "#3A2E4F", accent: "#D9B44A", year: "2026" },
  { id: 375, r: "foundry", name: "Colombia Nariño", origin: "コロンビア", process: "Washed", amount: 13, cur: "GBP", per: "250g", status: "now", color: "#B8433A", accent: "#F2E9DC", year: "2026" },
  { id: 376, r: "darkarts", name: "Ethiopia Yirgacheffe", origin: "エチオピア", process: "Washed", amount: 13, cur: "GBP", per: "250g", status: "now", color: "#EFE9DA", accent: "#2F5233", year: "2026" },
  { id: 377, r: "darkarts", name: "Kenya Kirinyaga", origin: "ケニア", process: "Washed", amount: 13, cur: "GBP", per: "250g", status: "sold", color: "#5A2E3A", accent: "#E8C8A0", year: "2026" },
  { id: 378, r: "girlswhogrind", name: "Ethiopia Sidama", origin: "エチオピア", process: "Natural", amount: 13, cur: "GBP", per: "250g", status: "now", color: "#7C4D8F", accent: "#F2E9DC", year: "2026" },
  { id: 379, r: "girlswhogrind", name: "Brazil Mogiana", origin: "ブラジル", process: "Natural", amount: 13, cur: "GBP", per: "250g", status: "now", color: "#22303A", accent: "#C8792E", year: "2026" },
  { id: 380, r: "mok", name: "Ethiopia Hambela", origin: "エチオピア", process: "Washed", amount: 16, cur: "EUR", per: "250g", status: "now", color: "#E2DBC8", accent: "#5A4632", year: "2026" },
  { id: 381, r: "mok", name: "Guatemala Acatenango", origin: "グアテマラ", process: "Washed", amount: 16, cur: "EUR", per: "250g", status: "now", color: "#6B2D3C", accent: "#EFE9DA", year: "2026" },
  { id: 382, r: "orcoffee", name: "Ethiopia Chelchele", origin: "エチオピア", process: "Natural", amount: 16, cur: "EUR", per: "250g", status: "now", color: "#4A5A3A", accent: "#EFE9DA", year: "2026" },
  { id: 383, r: "orcoffee", name: "Colombia Huila", origin: "コロンビア", process: "Washed", amount: 16, cur: "EUR", per: "250g", status: "sold", color: "#D97E3A", accent: "#2E2A24", year: "2026" },
  { id: 384, r: "caffenation", name: "Ethiopia Wolde", origin: "エチオピア", process: "Washed", amount: 16, cur: "EUR", per: "250g", status: "now", color: "#2E2A24", accent: "#C8A96A", year: "2026" },
  { id: 385, r: "caffenation", name: "Kenya Kirinyaga", origin: "ケニア", process: "Washed", amount: 16, cur: "EUR", per: "250g", status: "now", color: "#F4F1E8", accent: "#1A1815", year: "2026" },
  { id: 386, r: "coffeecircle", name: "Ethiopia Reko", origin: "エチオピア", process: "Natural", amount: 16, cur: "EUR", per: "250g", status: "now", color: "#1C1B19", accent: "#E8E2D2", year: "2026" },
  { id: 387, r: "coffeecircle", name: "Brazil Fazenda Rainha", origin: "ブラジル", process: "Natural", amount: 16, cur: "EUR", per: "250g", status: "now", color: "#F2EFE6", accent: "#8A3B2E", year: "2026" },
  { id: 388, r: "roststatte", name: "Ethiopia Aricha", origin: "エチオピア", process: "Washed", amount: 16, cur: "EUR", per: "250g", status: "now", color: "#3A2E4F", accent: "#D9B44A", year: "2026" },
  { id: 389, r: "roststatte", name: "Guatemala Huehuetenango", origin: "グアテマラ", process: "Washed", amount: 16, cur: "EUR", per: "250g", status: "sold", color: "#B8433A", accent: "#F2E9DC", year: "2026" },
  { id: 390, r: "whitelabel", name: "Ethiopia Guji", origin: "エチオピア", process: "Natural", amount: 16, cur: "EUR", per: "250g", status: "now", color: "#EFE9DA", accent: "#2F5233", year: "2026" },
  { id: 391, r: "whitelabel", name: "Colombia Popayán", origin: "コロンビア", process: "Washed", amount: 16, cur: "EUR", per: "250g", status: "now", color: "#5A2E3A", accent: "#E8C8A0", year: "2026" },
  { id: 392, r: "keen", name: "Ethiopia Yirgacheffe", origin: "エチオピア", process: "Washed", amount: 16, cur: "EUR", per: "250g", status: "now", color: "#7C4D8F", accent: "#F2E9DC", year: "2026" },
  { id: 393, r: "keen", name: "Kenya Kirinyaga", origin: "ケニア", process: "Washed", amount: 16, cur: "EUR", per: "250g", status: "now", color: "#22303A", accent: "#C8792E", year: "2026" },
  { id: 394, r: "industrybeans", name: "Ethiopia Sidama", origin: "エチオピア", process: "Natural", amount: 24, cur: "AUD", per: "250g", status: "now", color: "#E2DBC8", accent: "#5A4632", year: "2026" },
  { id: 395, r: "industrybeans", name: "Brazil Cerrado", origin: "ブラジル", process: "Natural", amount: 24, cur: "AUD", per: "250g", status: "sold", color: "#6B2D3C", accent: "#EFE9DA", year: "2026" },
  { id: 396, r: "industrybeans", name: "Industry Geisha", origin: "コロンビア", process: "Washed", amount: 48, cur: "AUD", per: "100g", status: "now", color: "#4A5A3A", accent: "#EFE9DA", year: "2026", vt: "geisha" },
  { id: 397, r: "codeblack", name: "Ethiopia Hambela", origin: "エチオピア", process: "Washed", amount: 24, cur: "AUD", per: "250g", status: "now", color: "#D97E3A", accent: "#2E2A24", year: "2026" },
  { id: 398, r: "codeblack", name: "Guatemala Antigua", origin: "グアテマラ", process: "Washed", amount: 24, cur: "AUD", per: "250g", status: "now", color: "#2E2A24", accent: "#C8A96A", year: "2026" },
  { id: 399, r: "dukes", name: "Ethiopia Chelchele", origin: "エチオピア", process: "Natural", amount: 24, cur: "AUD", per: "250g", status: "now", color: "#F4F1E8", accent: "#1A1815", year: "2026" },
  { id: 400, r: "dukes", name: "Colombia Tolima", origin: "コロンビア", process: "Washed", amount: 24, cur: "AUD", per: "250g", status: "now", color: "#1C1B19", accent: "#E8E2D2", year: "2026" },
  { id: 401, r: "veneziano", name: "Ethiopia Wolde", origin: "エチオピア", process: "Washed", amount: 24, cur: "AUD", per: "250g", status: "now", color: "#F2EFE6", accent: "#8A3B2E", year: "2026" },
  { id: 402, r: "veneziano", name: "Kenya Kirinyaga", origin: "ケニア", process: "Washed", amount: 24, cur: "AUD", per: "250g", status: "sold", color: "#3A2E4F", accent: "#D9B44A", year: "2026" },
  { id: 403, r: "kokako", name: "Ethiopia Reko", origin: "エチオピア", process: "Natural", amount: 24, cur: "NZD", per: "250g", status: "now", color: "#B8433A", accent: "#F2E9DC", year: "2026" },
  { id: 404, r: "kokako", name: "Brazil Mogiana", origin: "ブラジル", process: "Natural", amount: 24, cur: "NZD", per: "250g", status: "now", color: "#EFE9DA", accent: "#2F5233", year: "2026" },
  { id: 405, r: "eighthirty", name: "Ethiopia Aricha", origin: "エチオピア", process: "Washed", amount: 24, cur: "NZD", per: "250g", status: "now", color: "#5A2E3A", accent: "#E8C8A0", year: "2026" },
  { id: 406, r: "eighthirty", name: "Guatemala Acatenango", origin: "グアテマラ", process: "Washed", amount: 24, cur: "NZD", per: "250g", status: "now", color: "#7C4D8F", accent: "#F2E9DC", year: "2026" },
  { id: 407, r: "commonman", name: "Ethiopia Guji", origin: "エチオピア", process: "Natural", amount: 24, cur: "SGD", per: "250g", status: "now", color: "#22303A", accent: "#C8792E", year: "2026" },
  { id: 408, r: "commonman", name: "Colombia Cauca", origin: "コロンビア", process: "Washed", amount: 24, cur: "SGD", per: "250g", status: "sold", color: "#E2DBC8", accent: "#5A4632", year: "2026" },
  { id: 409, r: "apartment", name: "Ethiopia Yirgacheffe", origin: "エチオピア", process: "Washed", amount: 24, cur: "SGD", per: "250g", status: "now", color: "#6B2D3C", accent: "#EFE9DA", year: "2026" },
  { id: 410, r: "apartment", name: "Kenya Kirinyaga", origin: "ケニア", process: "Washed", amount: 24, cur: "SGD", per: "250g", status: "now", color: "#4A5A3A", accent: "#EFE9DA", year: "2026" },
  { id: 411, r: "fritz", name: "Ethiopia Sidama", origin: "エチオピア", process: "Natural", amount: 22000, cur: "KRW", per: "250g", status: "now", color: "#D97E3A", accent: "#2E2A24", year: "2026" },
  { id: 412, r: "fritz", name: "Brazil Fazenda Rainha", origin: "ブラジル", process: "Natural", amount: 22000, cur: "KRW", per: "250g", status: "now", color: "#2E2A24", accent: "#C8A96A", year: "2026" },
  { id: 413, r: "fritz", name: "Fritz Geisha", origin: "パナマ", process: "Washed", amount: 44000, cur: "KRW", per: "100g", status: "now", color: "#F4F1E8", accent: "#1A1815", year: "2026", vt: "geisha" },
  { id: 414, r: "anthracite", name: "Ethiopia Hambela", origin: "エチオピア", process: "Washed", amount: 22000, cur: "KRW", per: "250g", status: "now", color: "#1C1B19", accent: "#E8E2D2", year: "2026" },
  { id: 415, r: "anthracite", name: "Guatemala Huehuetenango", origin: "グアテマラ", process: "Washed", amount: 22000, cur: "KRW", per: "250g", status: "sold", color: "#F2EFE6", accent: "#8A3B2E", year: "2026" },
  { id: 416, r: "momos", name: "Ethiopia Chelchele", origin: "エチオピア", process: "Natural", amount: 22000, cur: "KRW", per: "250g", status: "now", color: "#3A2E4F", accent: "#D9B44A", year: "2026" },
  { id: 417, r: "momos", name: "Colombia Nariño", origin: "コロンビア", process: "Washed", amount: 22000, cur: "KRW", per: "250g", status: "now", color: "#B8433A", accent: "#F2E9DC", year: "2026" },
  { id: 418, r: "coffeelibre", name: "Ethiopia Wolde", origin: "エチオピア", process: "Washed", amount: 22000, cur: "KRW", per: "250g", status: "now", color: "#EFE9DA", accent: "#2F5233", year: "2026" },
  { id: 419, r: "coffeelibre", name: "Kenya Kirinyaga", origin: "ケニア", process: "Washed", amount: 22000, cur: "KRW", per: "250g", status: "now", color: "#5A2E3A", accent: "#E8C8A0", year: "2026" },
  { id: 420, r: "center", name: "Ethiopia Reko", origin: "エチオピア", process: "Natural", amount: 22000, cur: "KRW", per: "250g", status: "now", color: "#7C4D8F", accent: "#F2E9DC", year: "2026" },
  { id: 421, r: "center", name: "Brazil Cerrado", origin: "ブラジル", process: "Natural", amount: 22000, cur: "KRW", per: "250g", status: "sold", color: "#22303A", accent: "#C8792E", year: "2026" },
  { id: 422, r: "coffeeacademics", name: "Ethiopia Aricha", origin: "エチオピア", process: "Washed", amount: 150, cur: "HKD", per: "250g", status: "now", color: "#E2DBC8", accent: "#5A4632", year: "2026" },
  { id: 423, r: "coffeeacademics", name: "Guatemala Antigua", origin: "グアテマラ", process: "Washed", amount: 150, cur: "HKD", per: "250g", status: "now", color: "#6B2D3C", accent: "#EFE9DA", year: "2026" },
  { id: 424, r: "coffeeacademics", name: "The Geisha", origin: "パナマ", process: "Washed", amount: 320, cur: "HKD", per: "100g", status: "now", color: "#4A5A3A", accent: "#EFE9DA", year: "2026", vt: "geisha" },
  { id: 425, r: "cuppingroom", name: "Ethiopia Guji", origin: "エチオピア", process: "Natural", amount: 150, cur: "HKD", per: "250g", status: "now", color: "#D97E3A", accent: "#2E2A24", year: "2026" },
  { id: 426, r: "cuppingroom", name: "Colombia Huila", origin: "コロンビア", process: "Washed", amount: 150, cur: "HKD", per: "250g", status: "now", color: "#2E2A24", accent: "#C8A96A", year: "2026" },
  { id: 427, r: "roots", name: "Ethiopia Yirgacheffe", origin: "エチオピア", process: "Washed", amount: 520, cur: "THB", per: "250g", status: "now", color: "#F4F1E8", accent: "#1A1815", year: "2026" },
  { id: 428, r: "roots", name: "Kenya Kirinyaga", origin: "ケニア", process: "Washed", amount: 520, cur: "THB", per: "250g", status: "sold", color: "#1C1B19", accent: "#E8E2D2", year: "2026" },
  { id: 429, r: "roast", name: "Ethiopia Sidama", origin: "エチオピア", process: "Natural", amount: 520, cur: "THB", per: "250g", status: "now", color: "#F2EFE6", accent: "#8A3B2E", year: "2026" },
  { id: 430, r: "roast", name: "Brazil Mogiana", origin: "ブラジル", process: "Natural", amount: 520, cur: "THB", per: "250g", status: "now", color: "#3A2E4F", accent: "#D9B44A", year: "2026" },
  { id: 431, r: "mameya", name: "Ethiopia Hambela", origin: "エチオピア", process: "Washed", amount: 1800, cur: "JPY", per: "100g", status: "now", color: "#B8433A", accent: "#F2E9DC", year: "2026" },
  { id: 432, r: "mameya", name: "Guatemala Acatenango", origin: "グアテマラ", process: "Washed", amount: 1800, cur: "JPY", per: "100g", status: "now", color: "#EFE9DA", accent: "#2F5233", year: "2026" },
  { id: 433, r: "mameya", name: "Koffee Geisha", origin: "パナマ", process: "Washed", amount: 3800, cur: "JPY", per: "100g", status: "now", color: "#5A2E3A", accent: "#E8C8A0", year: "2026", vt: "geisha" },
  { id: 434, r: "passage", name: "Ethiopia Chelchele", origin: "エチオピア", process: "Natural", amount: 1800, cur: "JPY", per: "100g", status: "now", color: "#7C4D8F", accent: "#F2E9DC", year: "2026" },
  { id: 435, r: "passage", name: "Colombia Popayán", origin: "コロンビア", process: "Washed", amount: 1800, cur: "JPY", per: "100g", status: "sold", color: "#22303A", accent: "#C8792E", year: "2026" },
  { id: 436, r: "unlimited", name: "Ethiopia Wolde", origin: "エチオピア", process: "Washed", amount: 1800, cur: "JPY", per: "100g", status: "now", color: "#E2DBC8", accent: "#5A4632", year: "2026" },
  { id: 437, r: "unlimited", name: "Kenya Kirinyaga", origin: "ケニア", process: "Washed", amount: 1800, cur: "JPY", per: "100g", status: "now", color: "#6B2D3C", accent: "#EFE9DA", year: "2026" },
  { id: 438, r: "bearpond", name: "Ethiopia Reko", origin: "エチオピア", process: "Natural", amount: 1800, cur: "JPY", per: "100g", status: "now", color: "#4A5A3A", accent: "#EFE9DA", year: "2026" },
  { id: 439, r: "bearpond", name: "Brazil Fazenda Rainha", origin: "ブラジル", process: "Natural", amount: 1800, cur: "JPY", per: "100g", status: "now", color: "#D97E3A", accent: "#2E2A24", year: "2026" },
  { id: 440, r: "aboutlife", name: "Ethiopia Aricha", origin: "エチオピア", process: "Washed", amount: 1800, cur: "JPY", per: "100g", status: "now", color: "#2E2A24", accent: "#C8A96A", year: "2026" },
  { id: 441, r: "aboutlife", name: "Guatemala Huehuetenango", origin: "グアテマラ", process: "Washed", amount: 1800, cur: "JPY", per: "100g", status: "sold", color: "#F4F1E8", accent: "#1A1815", year: "2026" },
  { id: 442, r: "coffeewrights", name: "Ethiopia Guji", origin: "エチオピア", process: "Natural", amount: 1800, cur: "JPY", per: "100g", status: "now", color: "#F2EFE6", accent: "#8A3B2E", year: "2026" },
  { id: 443, r: "coffeewrights", name: "Colombia Huila", origin: "コロンビア", process: "Washed", amount: 1800, cur: "JPY", per: "100g", status: "sold", color: "#3A2E4F", accent: "#D9B44A", year: "2026" },
  { id: 444, r: "amameria", name: "Ethiopia Yirgacheffe", origin: "エチオピア", process: "Washed", amount: 1800, cur: "JPY", per: "100g", status: "now", color: "#B8433A", accent: "#F2E9DC", year: "2026" },
  { id: 445, r: "amameria", name: "Kenya Kirinyaga", origin: "ケニア", process: "Washed", amount: 1800, cur: "JPY", per: "100g", status: "now", color: "#EFE9DA", accent: "#2F5233", year: "2026" },
  { id: 446, r: "saza", name: "Ethiopia Sidama", origin: "エチオピア", process: "Natural", amount: 1800, cur: "JPY", per: "100g", status: "now", color: "#5A2E3A", accent: "#E8C8A0", year: "2026" },
  { id: 447, r: "saza", name: "Brazil Cerrado", origin: "ブラジル", process: "Natural", amount: 1800, cur: "JPY", per: "100g", status: "now", color: "#7C4D8F", accent: "#F2E9DC", year: "2026" },
  { id: 448, r: "sarutahiko", name: "Ethiopia Hambela", origin: "エチオピア", process: "Washed", amount: 1800, cur: "JPY", per: "100g", status: "now", color: "#22303A", accent: "#C8792E", year: "2026" },
  { id: 449, r: "sarutahiko", name: "Guatemala Antigua", origin: "グアテマラ", process: "Washed", amount: 1800, cur: "JPY", per: "100g", status: "sold", color: "#E2DBC8", accent: "#5A4632", year: "2026" },
  { id: 450, r: "yanaka", name: "Ethiopia Chelchele", origin: "エチオピア", process: "Natural", amount: 1800, cur: "JPY", per: "100g", status: "now", color: "#6B2D3C", accent: "#EFE9DA", year: "2026" },
  { id: 451, r: "yanaka", name: "Colombia Huila", origin: "コロンビア", process: "Washed", amount: 1800, cur: "JPY", per: "100g", status: "now", color: "#4A5A3A", accent: "#EFE9DA", year: "2026" },
  { id: 452, r: "streamer", name: "Ethiopia Wolde", origin: "エチオピア", process: "Washed", amount: 1800, cur: "JPY", per: "100g", status: "now", color: "#D97E3A", accent: "#2E2A24", year: "2026" },
  { id: 453, r: "streamer", name: "Kenya Kiambu", origin: "ケニア", process: "Washed", amount: 1800, cur: "JPY", per: "100g", status: "now", color: "#2E2A24", accent: "#C8A96A", year: "2026" },
  { id: 454, r: "obscura", name: "Ethiopia Reko", origin: "エチオピア", process: "Natural", amount: 1800, cur: "JPY", per: "100g", status: "now", color: "#F4F1E8", accent: "#1A1815", year: "2026" },
  { id: 455, r: "obscura", name: "Brazil Cerrado", origin: "ブラジル", process: "Natural", amount: 1800, cur: "JPY", per: "100g", status: "sold", color: "#1C1B19", accent: "#E8E2D2", year: "2026" },
  { id: 456, r: "mel", name: "Ethiopia Aricha", origin: "エチオピア", process: "Washed", amount: 1800, cur: "JPY", per: "100g", status: "now", color: "#F2EFE6", accent: "#8A3B2E", year: "2026" },
  { id: 457, r: "mel", name: "Guatemala Antigua", origin: "グアテマラ", process: "Washed", amount: 1800, cur: "JPY", per: "100g", status: "now", color: "#3A2E4F", accent: "#D9B44A", year: "2026" },
  { id: 458, r: "takamura", name: "Ethiopia Guji", origin: "エチオピア", process: "Natural", amount: 1800, cur: "JPY", per: "100g", status: "now", color: "#B8433A", accent: "#F2E9DC", year: "2026" },
  { id: 459, r: "takamura", name: "Colombia Huila", origin: "コロンビア", process: "Washed", amount: 1800, cur: "JPY", per: "100g", status: "now", color: "#EFE9DA", accent: "#2F5233", year: "2026" },
  { id: 460, r: "lilo", name: "Ethiopia Yirgacheffe", origin: "エチオピア", process: "Washed", amount: 1800, cur: "JPY", per: "100g", status: "now", color: "#5A2E3A", accent: "#E8C8A0", year: "2026" },
  { id: 461, r: "lilo", name: "Kenya Nyeri", origin: "ケニア", process: "Washed", amount: 1800, cur: "JPY", per: "100g", status: "sold", color: "#7C4D8F", accent: "#F2E9DC", year: "2026" },
  { id: 462, r: "ogawa", name: "Ethiopia Sidama", origin: "エチオピア", process: "Natural", amount: 1800, cur: "JPY", per: "100g", status: "now", color: "#22303A", accent: "#C8792E", year: "2026" },
  { id: 463, r: "ogawa", name: "Brazil Cerrado", origin: "ブラジル", process: "Natural", amount: 1800, cur: "JPY", per: "100g", status: "now", color: "#E2DBC8", accent: "#5A4632", year: "2026" },
  { id: 464, r: "weekenders", name: "Ethiopia Hambela", origin: "エチオピア", process: "Washed", amount: 1800, cur: "JPY", per: "100g", status: "now", color: "#6B2D3C", accent: "#EFE9DA", year: "2026" },
  { id: 465, r: "weekenders", name: "Guatemala Antigua", origin: "グアテマラ", process: "Washed", amount: 1800, cur: "JPY", per: "100g", status: "now", color: "#4A5A3A", accent: "#EFE9DA", year: "2026" },
  { id: 466, r: "manu", name: "Ethiopia Chelchele", origin: "エチオピア", process: "Natural", amount: 1800, cur: "JPY", per: "100g", status: "now", color: "#D97E3A", accent: "#2E2A24", year: "2026" },
  { id: 467, r: "manu", name: "Colombia Huila", origin: "コロンビア", process: "Washed", amount: 1800, cur: "JPY", per: "100g", status: "sold", color: "#2E2A24", accent: "#C8A96A", year: "2026" },
  { id: 468, r: "nem", name: "Ethiopia Wolde", origin: "エチオピア", process: "Washed", amount: 1800, cur: "JPY", per: "100g", status: "now", color: "#F4F1E8", accent: "#1A1815", year: "2026" },
  { id: 469, r: "nem", name: "Kenya Kirinyaga", origin: "ケニア", process: "Washed", amount: 1800, cur: "JPY", per: "100g", status: "now", color: "#1C1B19", accent: "#E8E2D2", year: "2026" },
  { id: 470, r: "kannon", name: "Ethiopia Reko", origin: "エチオピア", process: "Natural", amount: 1800, cur: "JPY", per: "100g", status: "now", color: "#F2EFE6", accent: "#8A3B2E", year: "2026" },
  { id: 471, r: "kannon", name: "Brazil Cerrado", origin: "ブラジル", process: "Natural", amount: 1800, cur: "JPY", per: "100g", status: "now", color: "#3A2E4F", accent: "#D9B44A", year: "2026" },
  { id: 472, r: "thelocal", name: "Ethiopia Aricha", origin: "エチオピア", process: "Washed", amount: 1800, cur: "JPY", per: "100g", status: "now", color: "#B8433A", accent: "#F2E9DC", year: "2026" },
  { id: 473, r: "thelocal", name: "Guatemala Antigua", origin: "グアテマラ", process: "Washed", amount: 1800, cur: "JPY", per: "100g", status: "sold", color: "#EFE9DA", accent: "#2F5233", year: "2026" },
  { id: 474, r: "sanwa", name: "Ethiopia Guji", origin: "エチオピア", process: "Natural", amount: 1800, cur: "JPY", per: "100g", status: "now", color: "#5A2E3A", accent: "#E8C8A0", year: "2026" },
  { id: 475, r: "sanwa", name: "Colombia Huila", origin: "コロンビア", process: "Washed", amount: 1800, cur: "JPY", per: "100g", status: "now", color: "#7C4D8F", accent: "#F2E9DC", year: "2026" },
  { id: 476, r: "coffeevalley", name: "Ethiopia Yirgacheffe", origin: "エチオピア", process: "Washed", amount: 1800, cur: "JPY", per: "100g", status: "now", color: "#22303A", accent: "#C8792E", year: "2026" },
  { id: 477, r: "coffeevalley", name: "Kenya Kiambu", origin: "ケニア", process: "Washed", amount: 1800, cur: "JPY", per: "100g", status: "now", color: "#E2DBC8", accent: "#5A4632", year: "2026" },
  { id: 478, r: "terarosa", name: "Ethiopia Sidama", origin: "エチオピア", process: "Natural", amount: 22000, cur: "KRW", per: "250g", status: "now", color: "#6B2D3C", accent: "#EFE9DA", year: "2026" },
  { id: 479, r: "terarosa", name: "Brazil Cerrado", origin: "ブラジル", process: "Natural", amount: 22000, cur: "KRW", per: "250g", status: "sold", color: "#4A5A3A", accent: "#EFE9DA", year: "2026" },
  { id: 480, r: "namusairo", name: "Ethiopia Hambela", origin: "エチオピア", process: "Washed", amount: 22000, cur: "KRW", per: "250g", status: "now", color: "#D97E3A", accent: "#2E2A24", year: "2026" },
  { id: 481, r: "namusairo", name: "Guatemala Antigua", origin: "グアテマラ", process: "Washed", amount: 22000, cur: "KRW", per: "250g", status: "now", color: "#2E2A24", accent: "#C8A96A", year: "2026" },
  { id: 482, r: "protokoll", name: "Ethiopia Chelchele", origin: "エチオピア", process: "Natural", amount: 22000, cur: "KRW", per: "250g", status: "now", color: "#F4F1E8", accent: "#1A1815", year: "2026" },
  { id: 483, r: "protokoll", name: "Colombia Huila", origin: "コロンビア", process: "Washed", amount: 22000, cur: "KRW", per: "250g", status: "now", color: "#1C1B19", accent: "#E8E2D2", year: "2026" },
  { id: 484, r: "manufact", name: "Ethiopia Wolde", origin: "エチオピア", process: "Washed", amount: 22000, cur: "KRW", per: "250g", status: "now", color: "#F2EFE6", accent: "#8A3B2E", year: "2026" },
  { id: 485, r: "manufact", name: "Kenya Nyeri", origin: "ケニア", process: "Washed", amount: 22000, cur: "KRW", per: "250g", status: "sold", color: "#3A2E4F", accent: "#D9B44A", year: "2026" },
  { id: 486, r: "coffeegraffiti", name: "Ethiopia Reko", origin: "エチオピア", process: "Natural", amount: 22000, cur: "KRW", per: "250g", status: "now", color: "#B8433A", accent: "#F2E9DC", year: "2026" },
  { id: 487, r: "coffeegraffiti", name: "Brazil Cerrado", origin: "ブラジル", process: "Natural", amount: 22000, cur: "KRW", per: "250g", status: "now", color: "#EFE9DA", accent: "#2F5233", year: "2026" },
  { id: 488, r: "fiveextracts", name: "Ethiopia Aricha", origin: "エチオピア", process: "Washed", amount: 22000, cur: "KRW", per: "250g", status: "now", color: "#5A2E3A", accent: "#E8C8A0", year: "2026" },
  { id: 489, r: "fiveextracts", name: "Guatemala Antigua", origin: "グアテマラ", process: "Washed", amount: 22000, cur: "KRW", per: "250g", status: "now", color: "#7C4D8F", accent: "#F2E9DC", year: "2026" },
  { id: 490, r: "felt", name: "Ethiopia Guji", origin: "エチオピア", process: "Natural", amount: 22000, cur: "KRW", per: "250g", status: "now", color: "#22303A", accent: "#C8792E", year: "2026" },
  { id: 491, r: "felt", name: "Colombia Huila", origin: "コロンビア", process: "Washed", amount: 22000, cur: "KRW", per: "250g", status: "sold", color: "#E2DBC8", accent: "#5A4632", year: "2026" },
  { id: 492, r: "lowkey", name: "Ethiopia Yirgacheffe", origin: "エチオピア", process: "Washed", amount: 22000, cur: "KRW", per: "250g", status: "now", color: "#6B2D3C", accent: "#EFE9DA", year: "2026" },
  { id: 493, r: "lowkey", name: "Kenya Kirinyaga", origin: "ケニア", process: "Washed", amount: 22000, cur: "KRW", per: "250g", status: "now", color: "#4A5A3A", accent: "#EFE9DA", year: "2026" },
  { id: 494, r: "mesh", name: "Ethiopia Sidama", origin: "エチオピア", process: "Natural", amount: 22000, cur: "KRW", per: "250g", status: "now", color: "#D97E3A", accent: "#2E2A24", year: "2026" },
  { id: 495, r: "mesh", name: "Brazil Cerrado", origin: "ブラジル", process: "Natural", amount: 22000, cur: "KRW", per: "250g", status: "now", color: "#2E2A24", accent: "#C8A96A", year: "2026" },
  { id: 496, r: "beanbrothers", name: "Ethiopia Hambela", origin: "エチオピア", process: "Washed", amount: 22000, cur: "KRW", per: "250g", status: "now", color: "#F4F1E8", accent: "#1A1815", year: "2026" },
  { id: 497, r: "beanbrothers", name: "Guatemala Antigua", origin: "グアテマラ", process: "Washed", amount: 22000, cur: "KRW", per: "250g", status: "sold", color: "#1C1B19", accent: "#E8E2D2", year: "2026" },
  { id: 498, r: "hellcafe", name: "Ethiopia Chelchele", origin: "エチオピア", process: "Natural", amount: 22000, cur: "KRW", per: "250g", status: "now", color: "#F2EFE6", accent: "#8A3B2E", year: "2026" },
  { id: 499, r: "hellcafe", name: "Colombia Huila", origin: "コロンビア", process: "Washed", amount: 22000, cur: "KRW", per: "250g", status: "now", color: "#3A2E4F", accent: "#D9B44A", year: "2026" },
  { id: 500, r: "peer", name: "Ethiopia Wolde", origin: "エチオピア", process: "Washed", amount: 22000, cur: "KRW", per: "250g", status: "now", color: "#B8433A", accent: "#F2E9DC", year: "2026" },
  { id: 501, r: "peer", name: "Kenya Kiambu", origin: "ケニア", process: "Washed", amount: 22000, cur: "KRW", per: "250g", status: "now", color: "#EFE9DA", accent: "#2F5233", year: "2026" },
  { id: 502, r: "elcafe", name: "Ethiopia Reko", origin: "エチオピア", process: "Natural", amount: 22000, cur: "KRW", per: "250g", status: "now", color: "#5A2E3A", accent: "#E8C8A0", year: "2026" },
  { id: 503, r: "elcafe", name: "Brazil Cerrado", origin: "ブラジル", process: "Natural", amount: 22000, cur: "KRW", per: "250g", status: "sold", color: "#7C4D8F", accent: "#F2E9DC", year: "2026" },
  { id: 504, r: "seesaw", name: "Ethiopia Aricha", origin: "エチオピア", process: "Washed", amount: 118, cur: "CNY", per: "250g", status: "now", color: "#22303A", accent: "#C8792E", year: "2026" },
  { id: 505, r: "seesaw", name: "Menglian", origin: "中国", process: "Washed", amount: 118, cur: "CNY", per: "250g", status: "now", color: "#E2DBC8", accent: "#5A4632", year: "2026" },
  { id: 506, r: "metalhands", name: "Ethiopia Guji", origin: "エチオピア", process: "Natural", amount: 118, cur: "CNY", per: "250g", status: "now", color: "#6B2D3C", accent: "#EFE9DA", year: "2026" },
  { id: 507, r: "metalhands", name: "Yunnan", origin: "中国", process: "Washed", amount: 118, cur: "CNY", per: "250g", status: "now", color: "#4A5A3A", accent: "#EFE9DA", year: "2026" },
  { id: 508, r: "fisheye", name: "Ethiopia Yirgacheffe", origin: "エチオピア", process: "Washed", amount: 118, cur: "CNY", per: "250g", status: "now", color: "#D97E3A", accent: "#2E2A24", year: "2026" },
  { id: 509, r: "fisheye", name: "Pu'er", origin: "中国", process: "Washed", amount: 118, cur: "CNY", per: "250g", status: "sold", color: "#2E2A24", accent: "#C8A96A", year: "2026" },
  { id: 510, r: "torch", name: "Ethiopia Sidama", origin: "エチオピア", process: "Natural", amount: 118, cur: "CNY", per: "250g", status: "now", color: "#F4F1E8", accent: "#1A1815", year: "2026" },
  { id: 511, r: "torch", name: "Baoshan", origin: "中国", process: "Washed", amount: 118, cur: "CNY", per: "250g", status: "now", color: "#1C1B19", accent: "#E8E2D2", year: "2026" },
  { id: 512, r: "mstand", name: "Ethiopia Hambela", origin: "エチオピア", process: "Washed", amount: 118, cur: "CNY", per: "250g", status: "now", color: "#F2EFE6", accent: "#8A3B2E", year: "2026" },
  { id: 513, r: "mstand", name: "Menglian", origin: "中国", process: "Washed", amount: 118, cur: "CNY", per: "250g", status: "now", color: "#3A2E4F", accent: "#D9B44A", year: "2026" },
  { id: 514, r: "unicafe", name: "Ethiopia Chelchele", origin: "エチオピア", process: "Natural", amount: 118, cur: "CNY", per: "250g", status: "now", color: "#B8433A", accent: "#F2E9DC", year: "2026" },
  { id: 515, r: "unicafe", name: "Yunnan", origin: "中国", process: "Washed", amount: 118, cur: "CNY", per: "250g", status: "sold", color: "#EFE9DA", accent: "#2F5233", year: "2026" },
  { id: 516, r: "sumo", name: "Ethiopia Wolde", origin: "エチオピア", process: "Washed", amount: 118, cur: "CNY", per: "250g", status: "now", color: "#5A2E3A", accent: "#E8C8A0", year: "2026" },
  { id: 517, r: "sumo", name: "Pu'er", origin: "中国", process: "Washed", amount: 118, cur: "CNY", per: "250g", status: "now", color: "#7C4D8F", accent: "#F2E9DC", year: "2026" },
  { id: 518, r: "berrybeans", name: "Ethiopia Reko", origin: "エチオピア", process: "Natural", amount: 118, cur: "CNY", per: "250g", status: "now", color: "#22303A", accent: "#C8792E", year: "2026" },
  { id: 519, r: "berrybeans", name: "Baoshan", origin: "中国", process: "Washed", amount: 118, cur: "CNY", per: "250g", status: "now", color: "#E2DBC8", accent: "#5A4632", year: "2026" },
  { id: 520, r: "ops", name: "Ethiopia Aricha", origin: "エチオピア", process: "Washed", amount: 118, cur: "CNY", per: "250g", status: "now", color: "#6B2D3C", accent: "#EFE9DA", year: "2026" },
  { id: 521, r: "ops", name: "Menglian", origin: "中国", process: "Washed", amount: 118, cur: "CNY", per: "250g", status: "sold", color: "#4A5A3A", accent: "#EFE9DA", year: "2026" },
  { id: 522, r: "greybox", name: "Ethiopia Guji", origin: "エチオピア", process: "Natural", amount: 118, cur: "CNY", per: "250g", status: "now", color: "#D97E3A", accent: "#2E2A24", year: "2026" },
  { id: 523, r: "greybox", name: "Yunnan", origin: "中国", process: "Washed", amount: 118, cur: "CNY", per: "250g", status: "now", color: "#2E2A24", accent: "#C8A96A", year: "2026" },
  { id: 524, r: "fluid", name: "Ethiopia Yirgacheffe", origin: "エチオピア", process: "Washed", amount: 118, cur: "CNY", per: "250g", status: "now", color: "#F4F1E8", accent: "#1A1815", year: "2026" },
  { id: 525, r: "fluid", name: "Pu'er", origin: "中国", process: "Washed", amount: 118, cur: "CNY", per: "250g", status: "now", color: "#1C1B19", accent: "#E8E2D2", year: "2026" },
  { id: 526, r: "simplekaffa", name: "Ethiopia Sidama", origin: "エチオピア", process: "Natural", amount: 620, cur: "TWD", per: "250g", status: "now", color: "#F2EFE6", accent: "#8A3B2E", year: "2026" },
  { id: 527, r: "simplekaffa", name: "Alishan", origin: "台湾", process: "Washed", amount: 620, cur: "TWD", per: "250g", status: "sold", color: "#3A2E4F", accent: "#D9B44A", year: "2026" },
  { id: 528, r: "simplekaffa", name: "Simple Geisha", origin: "パナマ", process: "Washed", amount: 1600, cur: "TWD", per: "100g", status: "now", color: "#B8433A", accent: "#F2E9DC", year: "2026", vt: "geisha" },
  { id: 529, r: "fikafika", name: "Ethiopia Hambela", origin: "エチオピア", process: "Washed", amount: 620, cur: "TWD", per: "250g", status: "now", color: "#EFE9DA", accent: "#2F5233", year: "2026" },
  { id: 530, r: "fikafika", name: "Nantou", origin: "台湾", process: "Washed", amount: 620, cur: "TWD", per: "250g", status: "now", color: "#5A2E3A", accent: "#E8C8A0", year: "2026" },
  { id: 531, r: "vwi", name: "Ethiopia Chelchele", origin: "エチオピア", process: "Natural", amount: 620, cur: "TWD", per: "250g", status: "now", color: "#7C4D8F", accent: "#F2E9DC", year: "2026" },
  { id: 532, r: "vwi", name: "Gukeng", origin: "台湾", process: "Washed", amount: 620, cur: "TWD", per: "250g", status: "now", color: "#22303A", accent: "#C8792E", year: "2026" },
  { id: 533, r: "peacelove", name: "Ethiopia Wolde", origin: "エチオピア", process: "Washed", amount: 620, cur: "TWD", per: "250g", status: "now", color: "#E2DBC8", accent: "#5A4632", year: "2026" },
  { id: 534, r: "peacelove", name: "Alishan", origin: "台湾", process: "Washed", amount: 620, cur: "TWD", per: "250g", status: "sold", color: "#6B2D3C", accent: "#EFE9DA", year: "2026" },
  { id: 535, r: "gabee", name: "Ethiopia Reko", origin: "エチオピア", process: "Natural", amount: 620, cur: "TWD", per: "250g", status: "now", color: "#4A5A3A", accent: "#EFE9DA", year: "2026" },
  { id: 536, r: "gabee", name: "Nantou", origin: "台湾", process: "Washed", amount: 620, cur: "TWD", per: "250g", status: "now", color: "#D97E3A", accent: "#2E2A24", year: "2026" },
  { id: 537, r: "rufous", name: "Ethiopia Aricha", origin: "エチオピア", process: "Washed", amount: 620, cur: "TWD", per: "250g", status: "now", color: "#2E2A24", accent: "#C8A96A", year: "2026" },
  { id: 538, r: "rufous", name: "Gukeng", origin: "台湾", process: "Washed", amount: 620, cur: "TWD", per: "250g", status: "now", color: "#F4F1E8", accent: "#1A1815", year: "2026" },
  { id: 539, r: "coffeestopover", name: "Ethiopia Guji", origin: "エチオピア", process: "Natural", amount: 620, cur: "TWD", per: "250g", status: "now", color: "#1C1B19", accent: "#E8E2D2", year: "2026" },
  { id: 540, r: "coffeestopover", name: "Alishan", origin: "台湾", process: "Washed", amount: 620, cur: "TWD", per: "250g", status: "sold", color: "#F2EFE6", accent: "#8A3B2E", year: "2026" },
  { id: 541, r: "congrats", name: "Ethiopia Yirgacheffe", origin: "エチオピア", process: "Washed", amount: 620, cur: "TWD", per: "250g", status: "now", color: "#3A2E4F", accent: "#D9B44A", year: "2026" },
  { id: 542, r: "congrats", name: "Nantou", origin: "台湾", process: "Washed", amount: 620, cur: "TWD", per: "250g", status: "now", color: "#B8433A", accent: "#F2E9DC", year: "2026" },
  { id: 543, r: "coffeesind", name: "Ethiopia Sidama", origin: "エチオピア", process: "Natural", amount: 620, cur: "TWD", per: "250g", status: "now", color: "#EFE9DA", accent: "#2F5233", year: "2026" },
  { id: 544, r: "coffeesind", name: "Gukeng", origin: "台湾", process: "Washed", amount: 620, cur: "TWD", per: "250g", status: "now", color: "#5A2E3A", accent: "#E8C8A0", year: "2026" },
  { id: 545, r: "mojocoffee", name: "Ethiopia Hambela", origin: "エチオピア", process: "Washed", amount: 620, cur: "TWD", per: "250g", status: "now", color: "#7C4D8F", accent: "#F2E9DC", year: "2026" },
  { id: 546, r: "mojocoffee", name: "Alishan", origin: "台湾", process: "Washed", amount: 620, cur: "TWD", per: "250g", status: "sold", color: "#22303A", accent: "#C8792E", year: "2026" },
  { id: 547, r: "blackstar", name: "Ethiopia Chelchele", origin: "エチオピア", process: "Natural", amount: 620, cur: "TWD", per: "250g", status: "now", color: "#E2DBC8", accent: "#5A4632", year: "2026" },
  { id: 548, r: "blackstar", name: "Nantou", origin: "台湾", process: "Washed", amount: 620, cur: "TWD", per: "250g", status: "now", color: "#6B2D3C", accent: "#EFE9DA", year: "2026" },
  { id: 549, r: "fineprint", name: "Ethiopia Wolde", origin: "エチオピア", process: "Washed", amount: 150, cur: "HKD", per: "250g", status: "now", color: "#4A5A3A", accent: "#EFE9DA", year: "2026" },
  { id: 550, r: "fineprint", name: "Guatemala Antigua", origin: "グアテマラ", process: "Washed", amount: 150, cur: "HKD", per: "250g", status: "now", color: "#D97E3A", accent: "#2E2A24", year: "2026" },
  { id: 551, r: "sensoryzero", name: "Ethiopia Reko", origin: "エチオピア", process: "Natural", amount: 150, cur: "HKD", per: "250g", status: "now", color: "#2E2A24", accent: "#C8A96A", year: "2026" },
  { id: 552, r: "sensoryzero", name: "Colombia Cauca", origin: "コロンビア", process: "Washed", amount: 150, cur: "HKD", per: "250g", status: "sold", color: "#F4F1E8", accent: "#1A1815", year: "2026" },
  { id: 553, r: "winstons", name: "Ethiopia Aricha", origin: "エチオピア", process: "Washed", amount: 150, cur: "HKD", per: "250g", status: "now", color: "#1C1B19", accent: "#E8E2D2", year: "2026" },
  { id: 554, r: "winstons", name: "Kenya Kirinyaga", origin: "ケニア", process: "Washed", amount: 150, cur: "HKD", per: "250g", status: "now", color: "#F2EFE6", accent: "#8A3B2E", year: "2026" },
  { id: 555, r: "dutchcolony", name: "Ethiopia Guji", origin: "エチオピア", process: "Natural", amount: 24, cur: "SGD", per: "250g", status: "now", color: "#3A2E4F", accent: "#D9B44A", year: "2026" },
  { id: 556, r: "dutchcolony", name: "Brazil Cerrado", origin: "ブラジル", process: "Natural", amount: 24, cur: "SGD", per: "250g", status: "now", color: "#B8433A", accent: "#F2E9DC", year: "2026" },
  { id: 557, r: "homeground", name: "Ethiopia Yirgacheffe", origin: "エチオピア", process: "Washed", amount: 24, cur: "SGD", per: "250g", status: "now", color: "#EFE9DA", accent: "#2F5233", year: "2026" },
  { id: 558, r: "homeground", name: "Guatemala Antigua", origin: "グアテマラ", process: "Washed", amount: 24, cur: "SGD", per: "250g", status: "sold", color: "#5A2E3A", accent: "#E8C8A0", year: "2026" },
  { id: 559, r: "alchemist", name: "Ethiopia Sidama", origin: "エチオピア", process: "Natural", amount: 24, cur: "SGD", per: "250g", status: "now", color: "#7C4D8F", accent: "#F2E9DC", year: "2026" },
  { id: 560, r: "alchemist", name: "Colombia Cauca", origin: "コロンビア", process: "Washed", amount: 24, cur: "SGD", per: "250g", status: "now", color: "#22303A", accent: "#C8792E", year: "2026" },
  { id: 561, r: "maxi", name: "Ethiopia Hambela", origin: "エチオピア", process: "Washed", amount: 24, cur: "SGD", per: "250g", status: "now", color: "#E2DBC8", accent: "#5A4632", year: "2026" },
  { id: 562, r: "maxi", name: "Kenya Kiambu", origin: "ケニア", process: "Washed", amount: 24, cur: "SGD", per: "250g", status: "now", color: "#6B2D3C", accent: "#EFE9DA", year: "2026" },
  { id: 563, r: "brave", name: "Ethiopia Chelchele", origin: "エチオピア", process: "Natural", amount: 520, cur: "THB", per: "250g", status: "now", color: "#4A5A3A", accent: "#EFE9DA", year: "2026" },
  { id: 564, r: "brave", name: "Doi Chang", origin: "タイ", process: "Washed", amount: 520, cur: "THB", per: "250g", status: "sold", color: "#D97E3A", accent: "#2E2A24", year: "2026" },
  { id: 565, r: "pacamara", name: "Ethiopia Wolde", origin: "エチオピア", process: "Washed", amount: 520, cur: "THB", per: "250g", status: "now", color: "#2E2A24", accent: "#C8A96A", year: "2026" },
  { id: 566, r: "pacamara", name: "Doi Tung", origin: "タイ", process: "Washed", amount: 520, cur: "THB", per: "250g", status: "now", color: "#F4F1E8", accent: "#1A1815", year: "2026" },
  { id: 567, r: "gallerydrip", name: "Ethiopia Reko", origin: "エチオピア", process: "Natural", amount: 520, cur: "THB", per: "250g", status: "now", color: "#1C1B19", accent: "#E8E2D2", year: "2026" },
  { id: 568, r: "gallerydrip", name: "Chiang Mai", origin: "タイ", process: "Washed", amount: 520, cur: "THB", per: "250g", status: "now", color: "#F2EFE6", accent: "#8A3B2E", year: "2026" },
  { id: 569, r: "rework", name: "Ethiopia Aricha", origin: "エチオピア", process: "Washed", amount: 520, cur: "THB", per: "250g", status: "now", color: "#3A2E4F", accent: "#D9B44A", year: "2026" },
  { id: 570, r: "rework", name: "Doi Chang", origin: "タイ", process: "Washed", amount: 520, cur: "THB", per: "250g", status: "sold", color: "#B8433A", accent: "#F2E9DC", year: "2026" },
  { id: 571, r: "factory43", name: "Ethiopia Guji", origin: "エチオピア", process: "Natural", amount: 260000, cur: "VND", per: "250g", status: "now", color: "#EFE9DA", accent: "#2F5233", year: "2026" },
  { id: 572, r: "factory43", name: "Da Lat", origin: "ベトナム", process: "Natural", amount: 260000, cur: "VND", per: "250g", status: "now", color: "#5A2E3A", accent: "#E8C8A0", year: "2026" },
  { id: 573, r: "laviet", name: "Ethiopia Yirgacheffe", origin: "エチオピア", process: "Washed", amount: 260000, cur: "VND", per: "250g", status: "now", color: "#7C4D8F", accent: "#F2E9DC", year: "2026" },
  { id: 574, r: "laviet", name: "Cau Dat", origin: "ベトナム", process: "Natural", amount: 260000, cur: "VND", per: "250g", status: "now", color: "#22303A", accent: "#C8792E", year: "2026" },
  { id: 575, r: "shin", name: "Ethiopia Sidama", origin: "エチオピア", process: "Natural", amount: 260000, cur: "VND", per: "250g", status: "now", color: "#E2DBC8", accent: "#5A4632", year: "2026" },
  { id: 576, r: "shin", name: "Son La", origin: "ベトナム", process: "Natural", amount: 260000, cur: "VND", per: "250g", status: "sold", color: "#6B2D3C", accent: "#EFE9DA", year: "2026" },
  { id: 577, r: "everyhalf", name: "Ethiopia Hambela", origin: "エチオピア", process: "Washed", amount: 260000, cur: "VND", per: "250g", status: "now", color: "#4A5A3A", accent: "#EFE9DA", year: "2026" },
  { id: 578, r: "everyhalf", name: "Dak Lak", origin: "ベトナム", process: "Natural", amount: 260000, cur: "VND", per: "250g", status: "now", color: "#D97E3A", accent: "#2E2A24", year: "2026" },
  { id: 579, r: "raaw", name: "Ethiopia Chelchele", origin: "エチオピア", process: "Natural", amount: 260000, cur: "VND", per: "250g", status: "now", color: "#2E2A24", accent: "#C8A96A", year: "2026" },
  { id: 580, r: "raaw", name: "Da Lat", origin: "ベトナム", process: "Natural", amount: 260000, cur: "VND", per: "250g", status: "now", color: "#F4F1E8", accent: "#1A1815", year: "2026" },
  { id: 581, r: "theworkshop", name: "Ethiopia Wolde", origin: "エチオピア", process: "Washed", amount: 260000, cur: "VND", per: "250g", status: "now", color: "#1C1B19", accent: "#E8E2D2", year: "2026" },
  { id: 582, r: "theworkshop", name: "Cau Dat", origin: "ベトナム", process: "Natural", amount: 260000, cur: "VND", per: "250g", status: "sold", color: "#F2EFE6", accent: "#8A3B2E", year: "2026" },
  { id: 583, r: "blackbird", name: "Ethiopia Reko", origin: "エチオピア", process: "Natural", amount: 260000, cur: "VND", per: "250g", status: "now", color: "#3A2E4F", accent: "#D9B44A", year: "2026" },
  { id: 584, r: "blackbird", name: "Son La", origin: "ベトナム", process: "Natural", amount: 260000, cur: "VND", per: "250g", status: "now", color: "#B8433A", accent: "#F2E9DC", year: "2026" },
  { id: 585, r: "tanamera", name: "Ethiopia Aricha", origin: "エチオピア", process: "Washed", amount: 180000, cur: "IDR", per: "250g", status: "now", color: "#EFE9DA", accent: "#2F5233", year: "2026" },
  { id: 586, r: "tanamera", name: "Flores Bajawa", origin: "インドネシア", process: "Washed", amount: 180000, cur: "IDR", per: "250g", status: "now", color: "#5A2E3A", accent: "#E8C8A0", year: "2026" },
  { id: 587, r: "anomali", name: "Ethiopia Guji", origin: "エチオピア", process: "Natural", amount: 180000, cur: "IDR", per: "250g", status: "now", color: "#7C4D8F", accent: "#F2E9DC", year: "2026" },
  { id: 588, r: "anomali", name: "Sumatra Mandheling", origin: "インドネシア", process: "Washed", amount: 180000, cur: "IDR", per: "250g", status: "sold", color: "#22303A", accent: "#C8792E", year: "2026" },
  { id: 589, r: "expat", name: "Ethiopia Yirgacheffe", origin: "エチオピア", process: "Washed", amount: 180000, cur: "IDR", per: "250g", status: "now", color: "#E2DBC8", accent: "#5A4632", year: "2026" },
  { id: 590, r: "expat", name: "Bali Kintamani", origin: "インドネシア", process: "Washed", amount: 180000, cur: "IDR", per: "250g", status: "now", color: "#6B2D3C", accent: "#EFE9DA", year: "2026" },
  { id: 591, r: "firstcrack", name: "Ethiopia Sidama", origin: "エチオピア", process: "Natural", amount: 180000, cur: "IDR", per: "250g", status: "now", color: "#4A5A3A", accent: "#EFE9DA", year: "2026" },
  { id: 592, r: "firstcrack", name: "Aceh Gayo", origin: "インドネシア", process: "Washed", amount: 180000, cur: "IDR", per: "250g", status: "now", color: "#D97E3A", accent: "#2E2A24", year: "2026" },
  { id: 593, r: "kina", name: "Ethiopia Hambela", origin: "エチオピア", process: "Washed", amount: 180000, cur: "IDR", per: "250g", status: "now", color: "#2E2A24", accent: "#C8A96A", year: "2026" },
  { id: 594, r: "kina", name: "Java Preanger", origin: "インドネシア", process: "Washed", amount: 180000, cur: "IDR", per: "250g", status: "sold", color: "#F4F1E8", accent: "#1A1815", year: "2026" },
  { id: 595, r: "commongrounds", name: "Ethiopia Chelchele", origin: "エチオピア", process: "Natural", amount: 180000, cur: "IDR", per: "250g", status: "now", color: "#1C1B19", accent: "#E8E2D2", year: "2026" },
  { id: 596, r: "commongrounds", name: "Toraja", origin: "インドネシア", process: "Washed", amount: 180000, cur: "IDR", per: "250g", status: "now", color: "#F2EFE6", accent: "#8A3B2E", year: "2026" },
  { id: 597, r: "crematology", name: "Ethiopia Wolde", origin: "エチオピア", process: "Washed", amount: 180000, cur: "IDR", per: "250g", status: "now", color: "#3A2E4F", accent: "#D9B44A", year: "2026" },
  { id: 598, r: "crematology", name: "Flores Bajawa", origin: "インドネシア", process: "Washed", amount: 180000, cur: "IDR", per: "250g", status: "now", color: "#B8433A", accent: "#F2E9DC", year: "2026" },
  { id: 599, r: "seniman", name: "Ethiopia Reko", origin: "エチオピア", process: "Natural", amount: 180000, cur: "IDR", per: "250g", status: "now", color: "#EFE9DA", accent: "#2F5233", year: "2026" },
  { id: 600, r: "seniman", name: "Sumatra Mandheling", origin: "インドネシア", process: "Washed", amount: 180000, cur: "IDR", per: "250g", status: "sold", color: "#5A2E3A", accent: "#E8C8A0", year: "2026" },
  { id: 601, r: "kopikalyan", name: "Ethiopia Aricha", origin: "エチオピア", process: "Washed", amount: 180000, cur: "IDR", per: "250g", status: "now", color: "#7C4D8F", accent: "#F2E9DC", year: "2026" },
  { id: 602, r: "kopikalyan", name: "Bali Kintamani", origin: "インドネシア", process: "Washed", amount: 180000, cur: "IDR", per: "250g", status: "now", color: "#22303A", accent: "#C8792E", year: "2026" },
  { id: 603, r: "vcr", name: "Ethiopia Guji", origin: "エチオピア", process: "Natural", amount: 58, cur: "MYR", per: "250g", status: "now", color: "#E2DBC8", accent: "#5A4632", year: "2026" },
  { id: 604, r: "vcr", name: "Brazil Cerrado", origin: "ブラジル", process: "Natural", amount: 58, cur: "MYR", per: "250g", status: "now", color: "#6B2D3C", accent: "#EFE9DA", year: "2026" },
  { id: 605, r: "pulp", name: "Ethiopia Yirgacheffe", origin: "エチオピア", process: "Washed", amount: 58, cur: "MYR", per: "250g", status: "now", color: "#4A5A3A", accent: "#EFE9DA", year: "2026" },
  { id: 606, r: "pulp", name: "Guatemala Antigua", origin: "グアテマラ", process: "Washed", amount: 58, cur: "MYR", per: "250g", status: "sold", color: "#D97E3A", accent: "#2E2A24", year: "2026" },
  { id: 607, r: "threelittlebirds", name: "Ethiopia Sidama", origin: "エチオピア", process: "Natural", amount: 58, cur: "MYR", per: "250g", status: "now", color: "#2E2A24", accent: "#C8A96A", year: "2026" },
  { id: 608, r: "threelittlebirds", name: "Colombia Cauca", origin: "コロンビア", process: "Washed", amount: 58, cur: "MYR", per: "250g", status: "now", color: "#F4F1E8", accent: "#1A1815", year: "2026" },
  { id: 609, r: "coffea", name: "Ethiopia Hambela", origin: "エチオピア", process: "Washed", amount: 58, cur: "MYR", per: "250g", status: "now", color: "#1C1B19", accent: "#E8E2D2", year: "2026" },
  { id: 610, r: "coffea", name: "Kenya Kiambu", origin: "ケニア", process: "Washed", amount: 58, cur: "MYR", per: "250g", status: "now", color: "#F2EFE6", accent: "#8A3B2E", year: "2026" },
  { id: 611, r: "artisanmy", name: "Ethiopia Chelchele", origin: "エチオピア", process: "Natural", amount: 58, cur: "MYR", per: "250g", status: "now", color: "#3A2E4F", accent: "#D9B44A", year: "2026" },
  { id: 612, r: "artisanmy", name: "Brazil Cerrado", origin: "ブラジル", process: "Natural", amount: 58, cur: "MYR", per: "250g", status: "sold", color: "#B8433A", accent: "#F2E9DC", year: "2026" },
  { id: 613, r: "yardstick", name: "Ethiopia Wolde", origin: "エチオピア", process: "Washed", amount: 720, cur: "PHP", per: "250g", status: "now", color: "#EFE9DA", accent: "#2F5233", year: "2026" },
  { id: 614, r: "yardstick", name: "Sagada", origin: "フィリピン", process: "Washed", amount: 720, cur: "PHP", per: "250g", status: "now", color: "#5A2E3A", accent: "#E8C8A0", year: "2026" },
  { id: 615, r: "edsa", name: "Ethiopia Reko", origin: "エチオピア", process: "Natural", amount: 720, cur: "PHP", per: "250g", status: "now", color: "#7C4D8F", accent: "#F2E9DC", year: "2026" },
  { id: 616, r: "edsa", name: "Mt. Apo", origin: "フィリピン", process: "Washed", amount: 720, cur: "PHP", per: "250g", status: "now", color: "#22303A", accent: "#C8792E", year: "2026" },
  { id: 617, r: "kalsada", name: "Ethiopia Aricha", origin: "エチオピア", process: "Washed", amount: 720, cur: "PHP", per: "250g", status: "now", color: "#E2DBC8", accent: "#5A4632", year: "2026" },
  { id: 618, r: "kalsada", name: "Kalinga", origin: "フィリピン", process: "Washed", amount: 720, cur: "PHP", per: "250g", status: "sold", color: "#6B2D3C", accent: "#EFE9DA", year: "2026" },
  { id: 619, r: "habitual", name: "Ethiopia Guji", origin: "エチオピア", process: "Natural", amount: 720, cur: "PHP", per: "250g", status: "now", color: "#4A5A3A", accent: "#EFE9DA", year: "2026" },
  { id: 620, r: "habitual", name: "Benguet", origin: "フィリピン", process: "Washed", amount: 720, cur: "PHP", per: "250g", status: "now", color: "#D97E3A", accent: "#2E2A24", year: "2026" },
  { id: 621, r: "bluetokai", name: "Ethiopia Yirgacheffe", origin: "エチオピア", process: "Washed", amount: 750, cur: "INR", per: "250g", status: "now", color: "#2E2A24", accent: "#C8A96A", year: "2026" },
  { id: 622, r: "bluetokai", name: "Chikmagalur", origin: "インド", process: "Washed", amount: 750, cur: "INR", per: "250g", status: "now", color: "#F4F1E8", accent: "#1A1815", year: "2026" },
  { id: 623, r: "thirdwave", name: "Ethiopia Sidama", origin: "エチオピア", process: "Natural", amount: 750, cur: "INR", per: "250g", status: "now", color: "#1C1B19", accent: "#E8E2D2", year: "2026" },
  { id: 624, r: "thirdwave", name: "Baba Budangiri", origin: "インド", process: "Washed", amount: 750, cur: "INR", per: "250g", status: "sold", color: "#F2EFE6", accent: "#8A3B2E", year: "2026" },
  { id: 625, r: "kcroasters", name: "Ethiopia Hambela", origin: "エチオピア", process: "Washed", amount: 750, cur: "INR", per: "250g", status: "now", color: "#3A2E4F", accent: "#D9B44A", year: "2026" },
  { id: 626, r: "kcroasters", name: "Attikan Estate", origin: "インド", process: "Washed", amount: 750, cur: "INR", per: "250g", status: "now", color: "#B8433A", accent: "#F2E9DC", year: "2026" },
  { id: 627, r: "corridorseven", name: "Ethiopia Chelchele", origin: "エチオピア", process: "Natural", amount: 750, cur: "INR", per: "250g", status: "now", color: "#EFE9DA", accent: "#2F5233", year: "2026" },
  { id: 628, r: "corridorseven", name: "Karnataka", origin: "インド", process: "Washed", amount: 750, cur: "INR", per: "250g", status: "now", color: "#5A2E3A", accent: "#E8C8A0", year: "2026" },
  { id: 629, r: "naivo", name: "Ethiopia Wolde", origin: "エチオピア", process: "Washed", amount: 750, cur: "INR", per: "250g", status: "now", color: "#7C4D8F", accent: "#F2E9DC", year: "2026" },
  { id: 630, r: "naivo", name: "Chikmagalur", origin: "インド", process: "Washed", amount: 750, cur: "INR", per: "250g", status: "sold", color: "#22303A", accent: "#C8792E", year: "2026" },
];

/* 為替（対円）— 既定は固定値。起動時にライブ値を取得して上書きし、
   一定間隔＋タブ復帰時に再取得して変動を自動反映する。 */
const FX_CURRENCIES = ["USD", "NOK", "DKK", "EUR", "AUD", "GBP", "SEK", "CAD", "NZD", "SGD", "ISK", "KRW", "HKD", "THB", "CNY", "IDR", "MYR", "PHP", "INR"];
const FX_DEFAULT = { JPY: 1, USD: 150, NOK: 14.5, DKK: 22, EUR: 165, AUD: 100, GBP: 195, SEK: 14, CAD: 108, NZD: 90, SGD: 112, ISK: 1.1, KRW: 0.11, HKD: 19, THB: 4.3, CNY: 21, TWD: 4.7, VND: 0.006, IDR: 0.0092, MYR: 33, PHP: 2.6, INR: 1.8 };
const RATES_TO_JPY = { ...FX_DEFAULT };
const CUR_SYMBOL = { JPY: "¥", USD: "$", NOK: "kr ", DKK: "kr ", EUR: "€", AUD: "A$", GBP: "£", SEK: "kr ", CAD: "C$", NZD: "NZ$", SGD: "S$", ISK: "kr ", KRW: "₩", HKD: "HK$", THB: "฿", CNY: "CN¥", TWD: "NT$", VND: "₫", IDR: "Rp ", MYR: "RM ", PHP: "₱", INR: "₹" };

/* ライブ為替の取得（キー不要・CORS対応の無料APIを順に試す）。
   返り値は「1通貨あたり何円か」= 対円レート。失敗時は例外。 */
async function fetchLiveRates() {
  // 1) Frankfurter（ECBデータ）。base=JPY で各通貨レートを得て逆数化。
  try {
    const res = await fetch(
      `https://api.frankfurter.app/latest?base=JPY&symbols=${FX_CURRENCIES.join(",")}`,
      { cache: "no-store" }
    );
    if (res.ok) {
      const data = await res.json();
      const raw = (data && data.rates) || {};
      const out = { JPY: 1 };
      for (const c of FX_CURRENCIES) {
        const v = Number(raw[c]);
        if (v > 0) out[c] = 1 / v;
      }
      if (Object.keys(out).length > 1) return { rates: out, date: data.date, source: "Frankfurter (ECB)" };
    }
  } catch {}
  // 2) フォールバック: open.er-api.com（base=JPY, rates は JPY→各通貨）。
  const res2 = await fetch("https://open.er-api.com/v6/latest/JPY", { cache: "no-store" });
  if (!res2.ok) throw new Error(`fx http ${res2.status}`);
  const data2 = await res2.json();
  const raw2 = (data2 && data2.rates) || {};
  const out2 = { JPY: 1 };
  for (const c of FX_CURRENCIES) {
    const v = Number(raw2[c]);
    if (v > 0) out2[c] = 1 / v;
  }
  if (Object.keys(out2).length <= 1) throw new Error("fx empty");
  const date = data2.time_last_update_utc ? new Date(data2.time_last_update_utc).toISOString().slice(0, 10) : null;
  return { rates: out2, date, source: "open.er-api.com" };
}

function toJPY(bean) { return bean.amount * RATES_TO_JPY[bean.cur]; }
function fmtPrice(bean, disp) {
  const jpy = toJPY(bean);
  if (disp === "JPY") return `¥${Math.round(jpy).toLocaleString()}`;
  return `$${(jpy / RATES_TO_JPY.USD).toFixed(2)}`;
}
function perGrams(bean) {
  if (bean.per.endsWith("oz")) return Math.round(parseFloat(bean.per) * 28.35);
  return parseInt(bean.per);
}
function fmtLocal(bean) {
  return `${CUR_SYMBOL[bean.cur]}${bean.amount.toLocaleString()}${bean.cur !== "JPY" && bean.cur !== "USD" ? ` ${bean.cur}` : ""}`;
}

function shopHref(roaster) {
  if (!roaster || !roaster.url) return null;
  const base = roaster.url.startsWith("http") ? roaster.url : "https://" + roaster.url;
  const sep = base.indexOf("?") === -1 ? "?" : "&";
  return base + sep + "utm_source=beantracker&utm_medium=referral&utm_campaign=go";
}

const STATUS = {
  now: { label: "NOW", jp: "在庫あり", dot: GREEN },
  sold: { label: "SOLD OUT", jp: "売り切れ", dot: AMBER },
  archive: { label: "ARCHIVE", jp: "記録", dot: GRAY },
};

const ORIGINS = ["すべて", "エチオピア", "ケニア", "コロンビア", "パナマ", "グアテマラ", "ブラジル", "コスタリカ", "ルワンダ", "エクアドル", "インドネシア", "ベトナム", "インド", "中国", "台湾", "タイ", "フィリピン", "ブレンド"];

/* ---------- パッケージ(標本)描画 ---------- */
function Package({ bean, small }) {
  const roaster = ROASTERS[bean.r];
  const faded = bean.status === "archive";
  return (
    <div
      style={{
        background: bean.color,
        borderRadius: 6,
        aspectRatio: "3 / 4",
        position: "relative",
        overflow: "hidden",
        filter: faded ? "grayscale(0.55) contrast(0.92)" : "none",
        opacity: faded ? 0.85 : 1,
        boxShadow: "0 1px 2px rgba(23,21,15,0.10)",
      }}
    >
      {/* 袋の折り返し */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "12%", background: "rgba(23,21,15,0.10)", borderBottom: "1px solid rgba(23,21,15,0.12)" }} />
      {/* ロースターマーク */}
      <div style={{ position: "absolute", top: "18%", left: 0, right: 0, textAlign: "center", color: bean.accent, fontSize: small ? 8 : 9, letterSpacing: "0.18em", fontWeight: 700 }}>
        {roaster.name.toUpperCase()}
      </div>
      {/* 豆名ラベル */}
      <div style={{ position: "absolute", top: "38%", left: "10%", right: "10%", textAlign: "center" }}>
        <div style={{ color: bean.accent, fontWeight: 700, fontSize: small ? 11 : 13, lineHeight: 1.25 }}>{bean.name}</div>
        <div style={{ marginTop: 6, height: 1, background: bean.accent, opacity: 0.5 }} />
        <div style={{ marginTop: 6, color: bean.accent, fontSize: small ? 8 : 9, letterSpacing: "0.08em", opacity: 0.9 }}>
          {bean.process.toUpperCase()}
        </div>
      </div>
      {/* 標本番号 */}
      <div style={{ position: "absolute", bottom: 6, right: 8, fontFamily: "ui-monospace, monospace", fontSize: 8, color: bean.accent, opacity: 0.7 }}>
        No.{String(bean.id).padStart(4, "0")}
      </div>
    </div>
  );
}

/* ---------- 豆カード ---------- */
function BeanCard({ bean, onOpen, onRoaster, cur }) {
  const s = STATUS[bean.status];
  return (
    <div className="bt-card" style={{ cursor: "pointer" }} onClick={() => onOpen(bean)}>
      <Package bean={bean} small />
      <div style={{ padding: "8px 2px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: s.dot, flexShrink: 0 }} />
          <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 9, color: s.dot === GRAY ? GRAY : s.dot, letterSpacing: "0.06em" }}>{s.label}</span>
          {bean.status !== "archive" && (
            <span style={{ marginLeft: "auto", fontFamily: "ui-monospace, monospace", fontSize: 9, color: INK }}>{fmtPrice(bean, cur)}/{perGrams(bean)}g</span>
          )}
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: INK, marginTop: 3, lineHeight: 1.3 }}>{bean.name}</div>
        <button
          onClick={(e) => { e.stopPropagation(); onRoaster(bean.r); }}
          style={{ fontSize: 10.5, color: GRAY, marginTop: 2, background: "none", border: "none", padding: 0, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 2 }}
        >
          {ROASTERS[bean.r].name}
        </button>
      </div>
    </div>
  );
}

/* ---------- 詳細シート ---------- */
function DetailSheet({ bean, onClose, onRoaster, cur }) {
  if (!bean) return null;
  const s = STATUS[bean.status];
  const roaster = ROASTERS[bean.r];
  const rows = [
    ["産地", bean.origin],
    ["精製", bean.process],
    ["現地価格", `${fmtLocal(bean)} / ${bean.per}`],
    [cur === "JPY" ? "円換算" : "ドル換算", `${fmtPrice(bean, cur)} / ${perGrams(bean)}g`],
    ["100gあたり", (() => {
      const jpy100 = (toJPY(bean) / perGrams(bean)) * 100;
      return cur === "JPY" ? `¥${Math.round(jpy100).toLocaleString()}` : `$${(jpy100 / RATES_TO_JPY.USD).toFixed(2)}`;
    })()],
    ["初出", bean.year],
  ];
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(23,21,15,0.45)", zIndex: 50, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div className="bt-sheet" onClick={(e) => e.stopPropagation()} style={{ background: PAPER, width: "100%", maxWidth: 480, borderRadius: "14px 14px 0 0", padding: "18px 20px 26px", maxHeight: "82vh", overflowY: "auto" }}>
        <div style={{ width: 34, height: 4, borderRadius: 999, background: LINE, margin: "0 auto 16px" }} />
        <div style={{ display: "flex", gap: 16 }}>
          <div className="bt-detail-pkg" style={{ width: 120, flexShrink: 0 }}><Package bean={bean} /></div>
          <div className="bt-detail-info" style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 7, height: 7, borderRadius: 999, background: s.dot }} />
              <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, color: s.dot === GRAY ? GRAY : s.dot }}>{s.label} — {s.jp}</span>
            </div>
            <div style={{ fontSize: 17, fontWeight: 700, color: INK, marginTop: 6, lineHeight: 1.25 }}>{bean.name}</div>
            <button onClick={() => { onClose(); onRoaster(bean.r); }} style={{ fontSize: 12, color: GRAY, marginTop: 3, background: "none", border: "none", padding: 0, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 2 }}>
              {roaster.name} — {roaster.city}
            </button>
            <table style={{ marginTop: 12, fontSize: 12, color: INK, borderCollapse: "collapse", width: "100%" }}>
              <tbody>
                {rows.map(([k, v]) => (
                  <tr key={k} style={{ borderTop: `1px solid ${LINE}` }}>
                    <td style={{ padding: "6px 0", color: GRAY, fontSize: 11, width: 62 }}>{k}</td>
                    <td style={{ padding: "6px 0", fontFamily: "ui-monospace, monospace", fontSize: 11.5 }}>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div style={{ marginTop: 18 }}>
          {bean.status === "now" && (
            roaster.url ? (
              <a href={shopHref(roaster)} target="_blank" rel="noopener noreferrer" style={{ display: "block", textAlign: "center", textDecoration: "none", width: "100%", padding: "13px 0", background: INK, color: PAPER, borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                {roaster.name} のECで見る ↗
              </a>
            ) : (
              <div style={{ width: "100%", padding: "13px 0", background: "#EDEAE1", color: GRAY, borderRadius: 8, fontSize: 13, fontWeight: 700, textAlign: "center" }}>ECサイト準備中</div>
            )
          )}
          {bean.status === "sold" && (
            <button style={{ width: "100%", padding: "13px 0", background: PAPER, color: INK, border: `1.5px solid ${INK}`, borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
              🔔 再入荷を待つ<span style={{ fontSize: 10, color: GRAY, fontWeight: 400, marginLeft: 8 }}>プレミアム機能(v2)</span>
            </button>
          )}
          {bean.status === "archive" && (
            <div style={{ textAlign: "center", fontSize: 11.5, color: GRAY, padding: "10px 0", borderTop: `1px solid ${LINE}` }}>
              この豆は販売を終了しています。図鑑の記録として保存されています。
            </div>
          )}
          {bean.status === "now" && roaster.url && (
            <div style={{ textAlign: "center", fontSize: 10, color: GRAY, marginTop: 8, fontFamily: "ui-monospace, monospace" }}>
              ↗ {roaster.url} へ送客（/go/{String(bean.id).padStart(4, "0")}・utm付き）
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- ロースターページ ---------- */
function RoasterPage({ rid, onOpen, onBack, onRoaster, initialTab, cur }) {
  const roaster = ROASTERS[rid];
  const [tab, setTab] = useState(initialTab || "now");
  const beans = BEANS.filter((b) => b.r === rid);
  const byStatus = (st) => beans.filter((b) => b.status === st);
  const tabs = [
    { key: "now", label: "NOW", n: byStatus("now").length },
    { key: "sold", label: "SOLD OUT", n: byStatus("sold").length },
    { key: "archive", label: "ARCHIVE", n: byStatus("archive").length },
  ];
  return (
    <div>
      <button onClick={onBack} style={{ background: "none", border: "none", color: GRAY, fontSize: 12, padding: "2px 0 12px", cursor: "pointer" }}>← 図鑑にもどる</button>
      <div style={{ borderTop: `2px solid ${INK}`, paddingTop: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: INK, margin: 0 }}>{roaster.name}</h2>
          <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, color: GRAY }}>{roaster.country} / {roaster.platform}</span>
        </div>
        <div style={{ fontSize: 12, color: GRAY, marginTop: 4 }}>{roaster.city} — {roaster.note}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 16px", marginTop: 12, padding: "10px 12px", background: "#F2F0E9", borderRadius: 8 }}>
          {[["創業", roaster.founded], ["焙煎", roaster.style], ["発送", roaster.ship], ["得意産地", roaster.focus]].map(([k, v]) => (
            <div key={k}>
              <div style={{ fontSize: 9, color: GRAY, letterSpacing: "0.06em" }}>{k}</div>
              <div style={{ fontSize: 11, color: INK, marginTop: 1, fontWeight: 600 }}>{v}</div>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 12, color: INK, lineHeight: 1.85, marginTop: 12, marginBottom: 0 }}>{roaster.bio}</p>
      </div>
      {roaster.url && (
        <a href={shopHref(roaster)} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%", marginTop: 14, padding: "12px 0", background: INK, color: PAPER, borderRadius: 8, fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
          {roaster.name} のECサイトで見る ↗
        </a>
      )}
      {roaster.url && (
        <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 9.5, color: GRAY, marginTop: 6, textAlign: "center" }}>{roaster.url} へ送客（utm付き）</div>
      )}
      <div style={{ display: "flex", gap: 0, marginTop: 18, borderBottom: `1px solid ${LINE}` }}>
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{
              flex: 1, padding: "9px 0", background: "none", border: "none", cursor: "pointer",
              fontFamily: "ui-monospace, monospace", fontSize: 11, letterSpacing: "0.05em",
              color: tab === t.key ? INK : GRAY, fontWeight: tab === t.key ? 700 : 400,
              borderBottom: tab === t.key ? `2px solid ${INK}` : "2px solid transparent",
            }}>
            {t.label} <span style={{ opacity: 0.6 }}>{t.n}</span>
          </button>
        ))}
      </div>
      {tab === "archive" ? (
        /* 年別の歴代ポートフォリオ */
        (() => {
          const arc = byStatus("archive");
          const years = [...new Set(arc.map((b) => b.year))].sort((a, b) => b - a);
          return years.map((yr) => (
            <div key={yr} style={{ marginTop: 20 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, borderBottom: `1px solid ${LINE}`, paddingBottom: 6 }}>
                <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 15, fontWeight: 700, color: INK }}>{yr}</span>
                <span style={{ fontSize: 10, color: GRAY }}>{arc.filter((b) => b.year === yr).length} 銘柄</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 16, marginTop: 14 }}>
                {arc.filter((b) => b.year === yr).map((b) => <BeanCard key={b.id} bean={b} onOpen={onOpen} onRoaster={onRoaster} cur={cur} />)}
              </div>
            </div>
          ));
        })()
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 16, marginTop: 18 }}>
          {byStatus(tab).map((b) => <BeanCard key={b.id} bean={b} onOpen={onOpen} onRoaster={onRoaster} cur={cur} />)}
        </div>
      )}
      {byStatus(tab).length === 0 && (
        <div style={{ textAlign: "center", color: GRAY, fontSize: 12, padding: "40px 0" }}>このカテゴリの豆はまだありません。</div>
      )}
      {tab === "archive" && byStatus("archive").length > 0 && (
        <div style={{ marginTop: 20, fontSize: 11, color: GRAY, borderTop: `1px solid ${LINE}`, paddingTop: 12 }}>
          ARCHIVEは巡回で「ページが消えた」豆を自動保存した記録です。{roaster.name}の歴代ラインナップとして残ります。
        </div>
      )}
    </div>
  );
}

/* ---------- 地球儀（ロースター探索） ---------- */
function GlobeView({ onRoaster }) {
  const svgRef = useRef(null);
  const wrapRef = useRef(null);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const size = Math.min(wrap.clientWidth, 380);
    const svg = d3.select(svgRef.current).attr("width", size).attr("height", size);
    svg.selectAll("*").remove();

    const projection = d3.geoOrthographic()
      .translate([size / 2, size / 2])
      .scale(size / 2 - 10)
      .clipAngle(90)
      .rotate([-139, -32]); // 日本から始まる
    const path = d3.geoPath(projection);

    // 球体
    svg.append("circle")
      .attr("cx", size / 2).attr("cy", size / 2).attr("r", size / 2 - 10)
      .attr("fill", "#F2F0E9").attr("stroke", INK).attr("stroke-width", 1.4);

    // 経緯線
    const gratPath = svg.append("path")
      .datum(d3.geoGraticule10())
      .attr("fill", "none").attr("stroke", "#CFCBBE").attr("stroke-width", 0.5);

    // 赤道だけ少し濃く
    const equator = svg.append("path")
      .datum({ type: "LineString", coordinates: d3.range(-180, 181, 2).map((l) => [l, 0]) })
      .attr("fill", "none").attr("stroke", "#B5B0A0").attr("stroke-width", 0.8);

    // ロースターのマーカー
    const markers = svg.append("g");
    const entries = Object.entries(ROASTERS);

    function render() {
      gratPath.attr("d", path);
      equator.attr("d", path);
      markers.selectAll("*").remove();
      const center = projection.invert([size / 2, size / 2]);
      entries.forEach(([rid, r]) => {
        if (d3.geoDistance(r.coord, center) > Math.PI / 2 - 0.05) return; // 裏側は描かない
        const [x, y] = projection(r.coord);
        const g = markers.append("g").style("cursor", "pointer")
          .on("click", () => setSelected(rid));
        g.append("circle").attr("cx", x).attr("cy", y).attr("r", 10).attr("fill", "transparent"); // タップ領域
        g.append("circle").attr("cx", x).attr("cy", y).attr("r", 4).attr("fill", GREEN).attr("stroke", PAPER).attr("stroke-width", 1.5);
        g.append("text").attr("x", x + 8).attr("y", y + 3)
          .attr("font-size", 10).attr("font-weight", 700).attr("fill", INK)
          .attr("font-family", "ui-monospace, monospace")
          .text(r.name);
      });
    }
    render();

    // ドラッグで回転 / 触っていない間はゆっくり自転
    let dragging = false;
    let last = null;
    const drag = d3.drag()
      .on("start", (e) => { dragging = true; last = [e.x, e.y]; })
      .on("drag", (e) => {
        const [lx, ly] = last;
        const rot = projection.rotate();
        projection.rotate([rot[0] + (e.x - lx) * 0.4, Math.max(-80, Math.min(80, rot[1] - (e.y - ly) * 0.4))]);
        last = [e.x, e.y];
        render();
      })
      .on("end", () => { dragging = false; });
    svg.call(drag);

    const timer = d3.timer(() => {
      if (dragging) return;
      const rot = projection.rotate();
      projection.rotate([rot[0] + 0.06, rot[1]]);
      render();
    });
    return () => timer.stop();
  }, []);

  const sel = selected ? ROASTERS[selected] : null;
  const selBeans = selected ? BEANS.filter((b) => b.r === selected) : [];

  return (
    <div>
      <div style={{ fontSize: 11, color: GRAY, marginBottom: 6 }}>
        地球を回してロースターを探す。実装では Mapbox の地球儀ビューを想定した試作です。
      </div>
      <div ref={wrapRef} style={{ display: "flex", justifyContent: "center", touchAction: "none" }}>
        <svg ref={svgRef} />
      </div>
      {/* 選択中のロースター */}
      {sel ? (
        <div style={{ borderTop: `2px solid ${INK}`, marginTop: 14, paddingTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{sel.name}</div>
            <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, color: GRAY }}>{sel.country} / {sel.platform}</span>
          </div>
          <div style={{ fontSize: 11.5, color: GRAY, marginTop: 2 }}>{sel.city} — {sel.note}</div>
          <div style={{ display: "flex", gap: 14, marginTop: 6, fontSize: 10.5, color: GRAY }}>
            <span>創業 {sel.founded}</span><span>{sel.style}</span><span>{sel.ship}</span>
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 8, fontFamily: "ui-monospace, monospace", fontSize: 10.5 }}>
            <span style={{ color: GREEN }}>NOW {selBeans.filter((b) => b.status === "now").length}</span>
            <span style={{ color: AMBER }}>SOLD OUT {selBeans.filter((b) => b.status === "sold").length}</span>
            <span style={{ color: GRAY }}>ARCHIVE {selBeans.filter((b) => b.status === "archive").length}</span>
          </div>
          <button onClick={() => onRoaster(selected)}
            style={{ width: "100%", marginTop: 12, padding: "11px 0", background: INK, color: PAPER, border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            このロースターの豆を見る →
          </button>
        </div>
      ) : (
        <div style={{ textAlign: "center", fontSize: 11, color: GRAY, marginTop: 12 }}>
          ● をタップするとロースターの詳細が出ます
        </div>
      )}
    </div>
  );
}

/* ---------- オープニング ---------- */
function Splash({ done }) {
  return (
    <div className={done ? "bt-splash bt-splash-out" : "bt-splash"}
      style={{
        position: "fixed", inset: 0, zIndex: 100, background: PAPER,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        pointerEvents: done ? "none" : "auto",
      }}>
      <div className="bt-mark" style={{ fontWeight: 800, fontSize: 24, letterSpacing: "0.35em", color: INK, paddingLeft: "0.35em" }}>
        BEAN&nbsp;TRACKER
      </div>
      <div className="bt-line" style={{ height: 2, background: INK, marginTop: 14 }} />
      <div className="bt-tag" style={{ fontSize: 11, color: GRAY, marginTop: 12, letterSpacing: "0.1em" }}>
        世界中のコーヒー豆に辿り着くためのインフラ
      </div>
    </div>
  );
}

/* ---------- 好み診断 ---------- */
const QUESTIONS = [
  { q: "どんな味わいが好きですか?", options: [
    { label: "すっきり明るい酸味", pts: { tw: 3, cc: 1, sey: 2, barn: 1, lacabra: 2, fuglen: 1, sqmile: 2, onibus: 2 } },
    { label: "フルーティで甘やか", pts: { onyx: 3, bibi: 1, pm: 2, april: 1, manhattan: 2, gardelli: 1, ona: 1 } },
    { label: "バランスよく飲みやすい", pts: { cc: 3, bibi: 1, april: 1, kurasu: 2, fuglen: 1, sqmile: 2, onibus: 1 } },
    { label: "飲んだことのない味に出会いたい", pts: { onyx: 2, tw: 1, bibi: 1, glitch: 2, pm: 1, manhattan: 1, gardelli: 3, ona: 2 } },
  ]},
  { q: "焙煎度の好みは?", options: [
    { label: "浅煎り一筋", pts: { tw: 3, cc: 1, sey: 2, glitch: 2, lacabra: 2, manhattan: 1, fuglen: 1, gardelli: 2 } },
    { label: "浅〜中浅で幅広く", pts: { cc: 2, onyx: 2, barn: 2, april: 1, kurasu: 2, sqmile: 2, onibus: 2, ona: 1 } },
    { label: "おまかせで楽しみたい", pts: { bibi: 2, onyx: 1, pm: 1, kurasu: 1, onibus: 1 } },
  ]},
  { q: "精製方式への冒険度は?", options: [
    { label: "クリーンな Washed が基本", pts: { tw: 3, cc: 2, sey: 2, april: 1, lacabra: 2, fuglen: 1, sqmile: 2, onibus: 1 } },
    { label: "Natural や Honey も好き", pts: { onyx: 2, bibi: 2, barn: 1, pm: 1, manhattan: 1, gardelli: 1, ona: 1 } },
    { label: "Anaerobic など実験系も試したい", pts: { onyx: 3, bibi: 1, pm: 2, glitch: 1, kurasu: 1, ona: 3, gardelli: 1 } },
  ]},
  { q: "豆の買い方は?", options: [
    { label: "国内でさっと届いてほしい", pts: { coffeewrights: 3, amameria: 3, saza: 3, sarutahiko: 3, yanaka: 3, streamer: 3, obscura: 3, mel: 3, takamura: 3, lilo: 3, ogawa: 3, weekenders: 3, manu: 3, nem: 3, kannon: 3, thelocal: 3, sanwa: 3, coffeevalley: 3, mameya: 3, passage: 3, unlimited: 3, bearpond: 3, aboutlife: 3, arabica: 3, maruyama: 3, switch: 3, woodberry: 3, rec: 3, trunk: 3, nozy: 3, horiguchi: 3, bibi: 3, glitch: 3, kurasu: 3, onibus: 3, philo: 3, leaves: 3, lightup: 3, county: 3 } },
    { label: "海外からの取り寄せも楽しい", pts: { terarosa: 2, namusairo: 2, protokoll: 2, manufact: 2, coffeegraffiti: 2, fiveextracts: 2, felt: 2, lowkey: 2, mesh: 2, beanbrothers: 2, hellcafe: 2, peer: 2, elcafe: 2, seesaw: 2, metalhands: 2, fisheye: 2, torch: 2, mstand: 2, unicafe: 2, sumo: 2, berrybeans: 2, ops: 2, greybox: 2, fluid: 2, simplekaffa: 2, fikafika: 2, vwi: 2, peacelove: 2, gabee: 2, rufous: 2, coffeestopover: 2, congrats: 2, coffeesind: 2, mojocoffee: 2, blackstar: 2, fineprint: 2, sensoryzero: 2, winstons: 2, dutchcolony: 2, homeground: 2, alchemist: 2, maxi: 2, brave: 2, pacamara: 2, gallerydrip: 2, rework: 2, factory43: 2, laviet: 2, shin: 2, everyhalf: 2, raaw: 2, theworkshop: 2, blackbird: 2, tanamera: 2, anomali: 2, expat: 2, firstcrack: 2, kina: 2, commongrounds: 2, crematology: 2, seniman: 2, kopikalyan: 2, vcr: 2, pulp: 2, threelittlebirds: 2, coffea: 2, artisanmy: 2, yardstick: 2, edsa: 2, kalsada: 2, habitual: 2, bluetokai: 2, thirdwave: 2, kcroasters: 2, corridorseven: 2, naivo: 2, supremerw: 2, kaffaoslo: 2, kaffebrenneriet: 2, jacu: 2, langora: 2, talormade: 2, lippe: 2, kaffemisjonen: 2, detlille: 2, jacobsensvart: 2, boenner: 2, java: 2, lykke: 2, solde: 2, gringo: 2, kafferaven: 2, stockholmroast: 2, kaffelabbet: 2, kaffekaross: 2, animakaffe: 2, kontra: 2, greatcoffee: 2, impact: 2, democratic: 2, cphcoffeelab: 2, original: 2, risteriet: 2, kaffa: 2, goodlife: 2, lehmus: 2, papu: 2, turun: 2, cafetoria: 2, helsinkiroastery: 2, kahiwa: 2, mokkamestarit: 2, record: 2, reykjavik: 2, kaffitar: 2, teogkaffi: 2, kuma: 2, elm: 2, herkimer: 2, victrola: 2, dune: 2, portrait: 2, littlewolf: 2, broadsheet: 2, speedwell: 2, slate: 2, demello: 2, monogram: 2, subtext: 2, extract: 2, cliftoncoffee: 2, northstar: 2, foundry: 2, darkarts: 2, girlswhogrind: 2, mok: 2, orcoffee: 2, caffenation: 2, coffeecircle: 2, roststatte: 2, whitelabel: 2, keen: 2, industrybeans: 2, codeblack: 2, dukes: 2, veneziano: 2, kokako: 2, eighthirty: 2, commonman: 2, apartment: 2, fritz: 2, anthracite: 2, momos: 2, coffeelibre: 2, center: 2, coffeeacademics: 2, cuppingroom: 2, roots: 2, roast: 2, standout: 2, damatteo: 2, johannystrom: 2, solberghansen: 2, talorjorgen: 2, andersenmaillard: 2, lot61: 2, bocca: 2, manvsmachine: 2, elbgold: 2, grams: 2, rightside: 2, hola: 2, elmagnifico: 2, workshop: 2, origincoffee: 2, caravan: 2, ozone: 2, kissthehippo: 2, intelligentsia: 2, counterculture: 2, bluebottle: 2, sightglass: 2, wreckingball: 2, equator: 2, sweetbloom: 2, corvus: 2, methodical: 2, tandem: 2, madcap: 2, temple: 2, camber: 2, pilot: 2, rosso: 2, singleo: 2, sevenseeds: 2, padre: 2, mecca: 2, allpress: 2, threemarks: 2, rocketbean: 2, ppp: 2, tw: 2, onyx: 2, cc: 2, april: 2, sey: 2, barn: 2, pm: 2, lacabra: 2, manhattan: 2, fuglen: 2, sqmile: 2, gardelli: 2, ona: 2, koppi: 2, drop: 2, morgon: 2, prolog: 2, friedhats: 2, dak: 2, bonanza: 2, fiveele: 2, nomad: 2, assembly: 2, colonna: 2, roundhill: 2, howell: 2, heart: 2, coava: 2, passenger: 2, bw: 2, verve: 2, prodigal: 2, ruby: 2, stumptown: 2, philseb: 2, p49: 2, marketlane: 2, smallbatch: 2, axil: 2, supreme: 2, flight: 2, nylon: 2 } },
  ]},
];

const TYPE_LABEL = {
  tw: { type: "北欧クリーン型", desc: "透明感のある酸味と、素材そのままの味を追いかけるタイプ。" },
  onyx: { type: "モダン・エクスペリメンタル型", desc: "新しい精製や華やかな甘さに心が動くタイプ。" },
  cc: { type: "クラシック・バランス型", desc: "毎日の一杯の完成度を大切にするタイプ。" },
  bibi: { type: "下町デイリー型", desc: "身近な店と、日々の暮らしに寄り添う豆を好むタイプ。" },
  april: { type: "精密レシピ型", desc: "再現性と甘さの設計に惹かれる、探究派のタイプ。" },
  glitch: { type: "極浅ハンター型", desc: "都心で希少品種や極浅の輪郭を追いかけるタイプ。" },
  sey: { type: "生産者トレース型", desc: "誰が作った豆かを知り、澄んだ果実味を好むタイプ。" },
  barn: { type: "ヨーロピアン果実型", desc: "ケニアの果実味など、王道の華やかさを好むタイプ。" },
  pm: { type: "サウス・エナジェティック型", desc: "鮮烈で攻めた味づくりにワクワクするタイプ。" },
  lacabra: { type: "透明感クリスタル型", desc: "花や果実の輪郭を澄んだまま味わいたいタイプ。" },
  manhattan: { type: "ヨーロピアン華やか型", desc: "甘く華やかな浅煎りと希少ロットに惹かれるタイプ。" },
  fuglen: { type: "北欧トラベラー型", desc: "北欧の澄んだ浅煎りを気軽に楽しみたいタイプ。" },
  kurasu: { type: "京都デイリー型", desc: "飲みやすさと季節感を大切にする、国内志向のタイプ。" },
  sqmile: { type: "ブリティッシュ王道型", desc: "産地の個性を素直に映す、王道の一杯を好むタイプ。" },
  gardelli: { type: "ゲイシャ探究型", desc: "香りの設計に振り切った最高級ロットに惹かれるタイプ。" },
  onibus: { type: "東京ダイレクト型", desc: "生産者との距離が近い、明るい酸の日常豆を好むタイプ。" },
  ona: { type: "コンペティション型", desc: "競技志向の緻密な精製と希少品種にワクワクするタイプ。" },

  koppi: { type: "北欧レジェンド型", desc: "北欧の透明感を長年の関係から引き出す一杯を好むタイプ。" },
  drop: { type: "ストックホルム・クリーン型", desc: "澄んだ酸とトレーサビリティを重んじるタイプ。" },
  morgon: { type: "西スウェーデン新鋭型", desc: "季節の極浅ロットを追いかけるタイプ。" },
  prolog: { type: "コペンハーゲン精鋭型", desc: "直接取引の軽やかな浅煎りに惹かれるタイプ。" },
  friedhats: { type: "ダッチ・クリーン型", desc: "果実味の際立つ極浅を好むタイプ。" },
  dak: { type: "遊び心エクスペリメンタル型", desc: "ファンキーな実験ロットにワクワクするタイプ。" },
  bonanza: { type: "ヨーロピアン・パイオニア型", desc: "王道と希少ゲイシャの両方を楽しみたいタイプ。" },
  fiveele: { type: "産地直取引型", desc: "フェアな調達と澄んだエチオピアを好むタイプ。" },
  nomad: { type: "スパニッシュ・ライト型", desc: "軽やかな浅煎りと季節感を楽しむタイプ。" },
  assembly: { type: "ロンドン実験型", desc: "攻めた精製と受賞ロットに惹かれるタイプ。" },
  colonna: { type: "探究カフェ型", desc: "常に変わる構成で発見を楽しむタイプ。" },
  roundhill: { type: "英カントリー実直型", desc: "飲みやすさと素材感を大切にするタイプ。" },
  howell: { type: "アメリカン・クラシック型", desc: "単一農園の完成度を味わいたいタイプ。" },
  heart: { type: "ポートランド透明型", desc: "カラメルより透明感を好むタイプ。" },
  coava: { type: "シングルオリジン一筋型", desc: "産地の個性を素直に味わいたいタイプ。" },
  passenger: { type: "多彩メニュー型", desc: "たくさんの選択肢から選ぶのが好きなタイプ。" },
  bw: { type: "チャンピオン・ブレンド型", desc: "切れのある果実味と設計を好むタイプ。" },
  verve: { type: "ウェストコースト型", desc: "デザインとカフェ文化ごと楽しみたいタイプ。" },
  prodigal: { type: "高精度フリーク型", desc: "徹底管理された果実味の設計に惹かれるタイプ。" },
  ruby: { type: "ミッドウェスト繊細型", desc: "甘さの伸びる繊細な浅煎りを好むタイプ。" },
  stumptown: { type: "サードウェーブ王道型", desc: "定番の完成度と歴史を味わいたいタイプ。" },
  philseb: { type: "カナディアン精緻型", desc: "直接取引と精緻な焙煎を好むタイプ。" },
  p49: { type: "BCワイド型", desc: "幅広い産地の銘品を楽しみたいタイプ。" },
  marketlane: { type: "メルボルン定番型", desc: "旬の素材を素直に楽しむタイプ。" },
  smallbatch: { type: "少量焙煎ブレンド型", desc: "安定したブレンドの心地よさを好むタイプ。" },
  axil: { type: "競技志向オージー型", desc: "整った明るい果実味に惹かれるタイプ。" },
  supreme: { type: "キーウィ草分け型", desc: "エスプレッソも単一産地も楽しみたいタイプ。" },
  flight: { type: "産地志向キーウィ型", desc: "クリーンで明るいカップを好むタイプ。" },
  philo: { type: "世界王者設計型", desc: "抽出まで見据えた設計に惹かれるタイプ。" },
  leaves: { type: "甘さ×香り追求型", desc: "甘さと香りに振り切った浅煎りを好むタイプ。" },
  lightup: { type: "吉祥寺クリーン型", desc: "身近で明るい果実感を楽しみたいタイプ。" },
  county: { type: "九州中米志向型", desc: "飲み心地の良い中米系を好むタイプ。" },
  nylon: { type: "シンガポール直取引型", desc: "東南アジア発の直接取引に惹かれるタイプ。" },
  standout: { type: "超高級ハンター型", desc: "世界の突出した希少ロットを狙い撃つタイプ。" },
  damatteo: { type: "ヨーテボリ職人型", desc: "競技志向の澄んだ北欧の一杯を好むタイプ。" },
  johannystrom: { type: "スウェディッシュ食卓型", desc: "毎日の食卓に馴染む透明な浅煎りを好むタイプ。" },
  solberghansen: { type: "ノルウェー老舗型", desc: "歴史ある直接取引の安心感を好むタイプ。" },
  talorjorgen: { type: "オスロ・ベーカリー型", desc: "浅煎りと菓子を一緒に楽しみたいタイプ。" },
  andersenmaillard: { type: "コペン現地焙煎型", desc: "焼きたての澄んだ甘さに惹かれるタイプ。" },
  lot61: { type: "アムス実力型", desc: "果実味とブラジルの甘さを楽しむタイプ。" },
  bocca: { type: "蘭・直接取引型", desc: "産地との関係を重んじる王道派タイプ。" },
  manvsmachine: { type: "ミュンヘン独立型", desc: "明るくクリーンな独立系を好むタイプ。" },
  elbgold: { type: "ハンブルク季節型", desc: "季節替わりの中浅煎りを楽しむタイプ。" },
  grams: { type: "ベルリン軽やか型", desc: "旬のロットを軽やかに楽しむタイプ。" },
  rightside: { type: "バルセロナ華やか型", desc: "華やかなゲイシャや受賞ロットに惹かれるタイプ。" },
  hola: { type: "マドリード・クリーン型", desc: "明るくクリーンな一杯を好むタイプ。" },
  elmagnifico: { type: "バルセロナ老舗型", desc: "歴史ある街の名店の味を好むタイプ。" },
  workshop: { type: "ロンドン実力型", desc: "季節のシングルオリジンを楽しむタイプ。" },
  origincoffee: { type: "英・直接取引型", desc: "産地との関係を軸にした王道派タイプ。" },
  caravan: { type: "ロンドン・オールデイ型", desc: "焙煎も食事も楽しむライフスタイル型。" },
  ozone: { type: "アンティポディアン型", desc: "豪NZ由来のカフェ文化ごと楽しむタイプ。" },
  kissthehippo: { type: "サステナブル志向型", desc: "環境配慮と品質を両立したいタイプ。" },
  intelligentsia: { type: "米・パイオニア型", desc: "業界を作ってきた王道の直接取引型。" },
  counterculture: { type: "透明性・教育型", desc: "背景を学びながら味わいたいタイプ。" },
  bluebottle: { type: "鮮度こだわり型", desc: "焼きたての鮮度を最優先するタイプ。" },
  sightglass: { type: "SF小ロット型", desc: "丁寧な小ロットとデザインを好むタイプ。" },
  wreckingball: { type: "SFクリーン型", desc: "明るくクリーンなカップを好むタイプ。" },
  equator: { type: "ベイエリア・サステナブル型", desc: "フェアで持続可能な調達を重んじるタイプ。" },
  sweetbloom: { type: "コロラド甘さ型", desc: "焼きたての甘さとクリーンさを好むタイプ。" },
  corvus: { type: "デンバー希少品種型", desc: "シドラなど希少品種にワクワクするタイプ。" },
  methodical: { type: "南部洗練型", desc: "丁寧な設計と洗練を好むタイプ。" },
  tandem: { type: "メイン親しみ型", desc: "飲みやすく親しみやすい一杯を好むタイプ。" },
  madcap: { type: "中西部精緻型", desc: "精緻で明るいカップを好むタイプ。" },
  temple: { type: "サクラメント季節型", desc: "質の高いシングルオリジンを楽しむタイプ。" },
  camber: { type: "北欧寄りUS型", desc: "澄んだ浅煎りを追いかけるタイプ。" },
  pilot: { type: "トロント直接取引型", desc: "品質管理された直接取引を好むタイプ。" },
  rosso: { type: "カルガリー小ロット型", desc: "少量丁寧な焙煎を好むタイプ。" },
  singleo: { type: "シドニー技術型", desc: "倫理的調達と技術志向を好むタイプ。" },
  sevenseeds: { type: "メルボルン中核型", desc: "季節のシングルオリジンを楽しむタイプ。" },
  padre: { type: "メルボルン果実型", desc: "豊かな果実味を楽しむタイプ。" },
  mecca: { type: "シドニー草分け型", desc: "安定した品質を長く愛したいタイプ。" },
  allpress: { type: "エスプレッソ名門型", desc: "エスプレッソの完成度を重んじるタイプ。" },
  arabica: { type: "ワールドワイド型", desc: "洗練された設計と希少ゲイシャを楽しむタイプ。" },
  maruyama: { type: "日本COE志向型", desc: "希少ロットと審美眼に惹かれるタイプ。" },
  switch: { type: "東京小焙煎型", desc: "澄んだシングルオリジンを好むタイプ。" },
  woodberry: { type: "東京新世代型", desc: "丁寧な焙煎と品質を好むタイプ。" },
  rec: { type: "福岡競技型", desc: "飲み心地の良い明るい一杯を好むタイプ。" },
  trunk: { type: "名古屋北欧寄り型", desc: "洗練された浅煎りを好むタイプ。" },
  nozy: { type: "東京単一産地型", desc: "シングルオリジン一筋のタイプ。" },
  horiguchi: { type: "日本老舗深煎り型", desc: "深みと甘さのある焙煎を好むタイプ。" },
  threemarks: { type: "バルセロナ新鋭型", desc: "旬のロットを軽やかに楽しむタイプ。" },
  rocketbean: { type: "バルト象徴型", desc: "地域を代表する一杯を楽しみたいタイプ。" },
  ppp: { type: "シンガポール名門型", desc: "調達から焙煎まで一貫した品質を好むタイプ。" },
  supremerw: { type: "Osloのノルウェー型", desc: "Supreme Roastworksの世界観に惹かれるタイプ。" },
  kaffaoslo: { type: "Osloのノルウェー型", desc: "Kaffaの世界観に惹かれるタイプ。" },
  kaffebrenneriet: { type: "Osloのノルウェー型", desc: "Kaffebrennerietの世界観に惹かれるタイプ。" },
  jacu: { type: "Ålesundのノルウェー型", desc: "Jacu Coffee Roasteryの世界観に惹かれるタイプ。" },
  langora: { type: "Stjørdalのノルウェー型", desc: "Langøra Kaffeの世界観に惹かれるタイプ。" },
  talormade: { type: "Osloのノルウェー型", desc: "Talormadeの世界観に惹かれるタイプ。" },
  lippe: { type: "Osloのノルウェー型", desc: "Lippeの世界観に惹かれるタイプ。" },
  kaffemisjonen: { type: "Bergenのノルウェー型", desc: "Kaffemisjonenの世界観に惹かれるタイプ。" },
  detlille: { type: "Bergenのノルウェー型", desc: "Det Lille Kaffekompaniの世界観に惹かれるタイプ。" },
  jacobsensvart: { type: "Trondheimのノルウェー型", desc: "Jacobsen & Svartの世界観に惹かれるタイプ。" },
  boenner: { type: "Osloのノルウェー型", desc: "Bønner i Byenの世界観に惹かれるタイプ。" },
  java: { type: "Osloのノルウェー型", desc: "Java Espressobarの世界観に惹かれるタイプ。" },
  lykke: { type: "Stockholmのスウェーデン型", desc: "Lykke Kaffegårdarの世界観に惹かれるタイプ。" },
  solde: { type: "Malmöのスウェーデン型", desc: "Solde Kafferosteriの世界観に惹かれるタイプ。" },
  gringo: { type: "Göteborgのスウェーデン型", desc: "Gringo Nordicの世界観に惹かれるタイプ。" },
  kafferaven: { type: "Göteborgのスウェーデン型", desc: "Kafferävenの世界観に惹かれるタイプ。" },
  stockholmroast: { type: "Stockholmのスウェーデン型", desc: "Stockholm Roastの世界観に惹かれるタイプ。" },
  kaffelabbet: { type: "Stockholmのスウェーデン型", desc: "Kaffelabbetの世界観に惹かれるタイプ。" },
  kaffekaross: { type: "Göteborgのスウェーデン型", desc: "Kaffekarossの世界観に惹かれるタイプ。" },
  animakaffe: { type: "Malmöのスウェーデン型", desc: "Anima Kaffeの世界観に惹かれるタイプ。" },
  kontra: { type: "Københavnのデンマーク型", desc: "Kontra Coffeeの世界観に惹かれるタイプ。" },
  greatcoffee: { type: "Aarhusのデンマーク型", desc: "Great Coffeeの世界観に惹かれるタイプ。" },
  impact: { type: "Københavnのデンマーク型", desc: "Impact Roastersの世界観に惹かれるタイプ。" },
  democratic: { type: "Københavnのデンマーク型", desc: "Democratic Coffeeの世界観に惹かれるタイプ。" },
  cphcoffeelab: { type: "Københavnのデンマーク型", desc: "Copenhagen Coffee Labの世界観に惹かれるタイプ。" },
  original: { type: "Københavnのデンマーク型", desc: "Original Coffeeの世界観に惹かれるタイプ。" },
  risteriet: { type: "Københavnのデンマーク型", desc: "Risteriet Coffeeの世界観に惹かれるタイプ。" },
  kaffa: { type: "Helsinkiのフィンランド型", desc: "Kaffa Roasteryの世界観に惹かれるタイプ。" },
  goodlife: { type: "Helsinkiのフィンランド型", desc: "Good Life Coffeeの世界観に惹かれるタイプ。" },
  lehmus: { type: "Lahtiのフィンランド型", desc: "Lehmus Roasteryの世界観に惹かれるタイプ。" },
  papu: { type: "Porvooのフィンランド型", desc: "Paahtimo Papuの世界観に惹かれるタイプ。" },
  turun: { type: "Turkuのフィンランド型", desc: "Turun Kahvipaahtimoの世界観に惹かれるタイプ。" },
  cafetoria: { type: "Lohjaのフィンランド型", desc: "Cafetoria Roasteryの世界観に惹かれるタイプ。" },
  helsinkiroastery: { type: "Helsinkiのフィンランド型", desc: "Helsinki Coffee Roasteryの世界観に惹かれるタイプ。" },
  kahiwa: { type: "Helsinkiのフィンランド型", desc: "Kahiwa Coffee Roastersの世界観に惹かれるタイプ。" },
  mokkamestarit: { type: "Helsinkiのフィンランド型", desc: "Mokkamestaritの世界観に惹かれるタイプ。" },
  record: { type: "Helsinkiのフィンランド型", desc: "Record Coffeeの世界観に惹かれるタイプ。" },
  reykjavik: { type: "Reykjavíkのアイスランド型", desc: "Reykjavik Roastersの世界観に惹かれるタイプ。" },
  kaffitar: { type: "Reykjavíkのアイスランド型", desc: "Kaffitárの世界観に惹かれるタイプ。" },
  teogkaffi: { type: "Reykjavíkのアイスランド型", desc: "Te & Kaffiの世界観に惹かれるタイプ。" },
  kuma: { type: "Seattleのアメリカ型", desc: "Kuma Coffeeの世界観に惹かれるタイプ。" },
  elm: { type: "Seattleのアメリカ型", desc: "Elm Coffee Roastersの世界観に惹かれるタイプ。" },
  herkimer: { type: "Seattleのアメリカ型", desc: "Herkimer Coffeeの世界観に惹かれるタイプ。" },
  victrola: { type: "Seattleのアメリカ型", desc: "Victrola Coffeeの世界観に惹かれるタイプ。" },
  dune: { type: "Santa Barbaraのアメリカ型", desc: "Dune Coffeeの世界観に惹かれるタイプ。" },
  portrait: { type: "Atlantaのアメリカ型", desc: "Portrait Coffeeの世界観に惹かれるタイプ。" },
  littlewolf: { type: "Amherstのアメリカ型", desc: "Little Wolf Coffeeの世界観に惹かれるタイプ。" },
  broadsheet: { type: "Cambridgeのアメリカ型", desc: "Broadsheet Coffeeの世界観に惹かれるタイプ。" },
  speedwell: { type: "Bostonのアメリカ型", desc: "Speedwell Coffeeの世界観に惹かれるタイプ。" },
  slate: { type: "Seattleのアメリカ型", desc: "Slate Coffee Roastersの世界観に惹かれるタイプ。" },
  demello: { type: "Torontoのカナダ型", desc: "De Melloの世界観に惹かれるタイプ。" },
  monogram: { type: "Calgaryのカナダ型", desc: "Monogram Coffeeの世界観に惹かれるタイプ。" },
  subtext: { type: "Torontoのカナダ型", desc: "Subtext Coffeeの世界観に惹かれるタイプ。" },
  extract: { type: "Bristolのイギリス型", desc: "Extract Coffeeの世界観に惹かれるタイプ。" },
  cliftoncoffee: { type: "Bristolのイギリス型", desc: "Clifton Coffeeの世界観に惹かれるタイプ。" },
  northstar: { type: "Leedsのイギリス型", desc: "North Star Coffeeの世界観に惹かれるタイプ。" },
  foundry: { type: "Sheffieldのイギリス型", desc: "Foundry Coffeeの世界観に惹かれるタイプ。" },
  darkarts: { type: "Londonのイギリス型", desc: "Dark Arts Coffeeの世界観に惹かれるタイプ。" },
  girlswhogrind: { type: "Wiltshireのイギリス型", desc: "Girls Who Grindの世界観に惹かれるタイプ。" },
  mok: { type: "Ghentのベルギー型", desc: "MOK Coffeeの世界観に惹かれるタイプ。" },
  orcoffee: { type: "Ghentのベルギー型", desc: "OR Coffeeの世界観に惹かれるタイプ。" },
  caffenation: { type: "Antwerpのベルギー型", desc: "Caffènationの世界観に惹かれるタイプ。" },
  coffeecircle: { type: "Berlinのドイツ型", desc: "Coffee Circleの世界観に惹かれるタイプ。" },
  roststatte: { type: "Berlinのドイツ型", desc: "Röststätteの世界観に惹かれるタイプ。" },
  whitelabel: { type: "Amsterdamのオランダ型", desc: "White Label Coffeeの世界観に惹かれるタイプ。" },
  keen: { type: "Rotterdamのオランダ型", desc: "Keen Coffeeの世界観に惹かれるタイプ。" },
  industrybeans: { type: "Melbourneのオーストラリア型", desc: "Industry Beansの世界観に惹かれるタイプ。" },
  codeblack: { type: "Melbourneのオーストラリア型", desc: "Code Black Coffeeの世界観に惹かれるタイプ。" },
  dukes: { type: "Melbourneのオーストラリア型", desc: "Dukes Coffeeの世界観に惹かれるタイプ。" },
  veneziano: { type: "Melbourneのオーストラリア型", desc: "Veneziano Coffeeの世界観に惹かれるタイプ。" },
  kokako: { type: "Aucklandのニュージーランド型", desc: "Kōkakoの世界観に惹かれるタイプ。" },
  eighthirty: { type: "Aucklandのニュージーランド型", desc: "Eighthirtyの世界観に惹かれるタイプ。" },
  commonman: { type: "Singaporeのシンガポール型", desc: "Common Man Coffeeの世界観に惹かれるタイプ。" },
  apartment: { type: "Singaporeのシンガポール型", desc: "Apartment Coffeeの世界観に惹かれるタイプ。" },
  fritz: { type: "Seoulの韓国型", desc: "Fritz Coffeeの世界観に惹かれるタイプ。" },
  anthracite: { type: "Seoulの韓国型", desc: "Anthracite Coffeeの世界観に惹かれるタイプ。" },
  momos: { type: "Busanの韓国型", desc: "Momos Coffeeの世界観に惹かれるタイプ。" },
  coffeelibre: { type: "Seoulの韓国型", desc: "Coffee Libreの世界観に惹かれるタイプ。" },
  center: { type: "Seoulの韓国型", desc: "Center Coffeeの世界観に惹かれるタイプ。" },
  coffeeacademics: { type: "Hong Kongの香港型", desc: "The Coffee Academicsの世界観に惹かれるタイプ。" },
  cuppingroom: { type: "Hong Kongの香港型", desc: "The Cupping Roomの世界観に惹かれるタイプ。" },
  roots: { type: "Bangkokのタイ型", desc: "Roots Coffeeの世界観に惹かれるタイプ。" },
  roast: { type: "Bangkokのタイ型", desc: "Roast Coffeeの世界観に惹かれるタイプ。" },
  mameya: { type: "東京の日本型", desc: "Koffee Mameyaの世界観に惹かれるタイプ。" },
  passage: { type: "東京の日本型", desc: "Passage Coffeeの世界観に惹かれるタイプ。" },
  unlimited: { type: "東京の日本型", desc: "Unlimited Coffeeの世界観に惹かれるタイプ。" },
  bearpond: { type: "東京の日本型", desc: "Bear Pond Espressoの世界観に惹かれるタイプ。" },
  aboutlife: { type: "東京の日本型", desc: "About Life Coffeeの世界観に惹かれるタイプ。" },
  coffeewrights: { type: "東京の日本型", desc: "Coffee Wrightsの世界観に惹かれるタイプ。" },
  amameria: { type: "東京の日本型", desc: "Amameria Espressoの世界観に惹かれるタイプ。" },
  saza: { type: "ひたちなかの日本型", desc: "Saza Coffeeの世界観に惹かれるタイプ。" },
  sarutahiko: { type: "東京の日本型", desc: "Sarutahiko Coffeeの世界観に惹かれるタイプ。" },
  yanaka: { type: "東京の日本型", desc: "Yanaka Coffeeの世界観に惹かれるタイプ。" },
  streamer: { type: "東京の日本型", desc: "Streamer Coffeeの世界観に惹かれるタイプ。" },
  obscura: { type: "東京の日本型", desc: "Obscura Coffeeの世界観に惹かれるタイプ。" },
  mel: { type: "大阪の日本型", desc: "Mel Coffee Roastersの世界観に惹かれるタイプ。" },
  takamura: { type: "大阪の日本型", desc: "Takamura Coffeeの世界観に惹かれるタイプ。" },
  lilo: { type: "大阪の日本型", desc: "LiLo Coffee Roastersの世界観に惹かれるタイプ。" },
  ogawa: { type: "京都の日本型", desc: "Ogawa Coffeeの世界観に惹かれるタイプ。" },
  weekenders: { type: "京都の日本型", desc: "Weekenders Coffeeの世界観に惹かれるタイプ。" },
  manu: { type: "福岡の日本型", desc: "Manu Coffeeの世界観に惹かれるタイプ。" },
  nem: { type: "東京の日本型", desc: "Nem Coffee & Espressoの世界観に惹かれるタイプ。" },
  kannon: { type: "名古屋の日本型", desc: "Kannon Coffeeの世界観に惹かれるタイプ。" },
  thelocal: { type: "東京の日本型", desc: "The Local Coffee Standの世界観に惹かれるタイプ。" },
  sanwa: { type: "大阪の日本型", desc: "Sanwa Coffee Worksの世界観に惹かれるタイプ。" },
  coffeevalley: { type: "東京の日本型", desc: "Coffee Valleyの世界観に惹かれるタイプ。" },
  terarosa: { type: "江陵の韓国型", desc: "Terarosaの世界観に惹かれるタイプ。" },
  namusairo: { type: "ソウルの韓国型", desc: "Namusairoの世界観に惹かれるタイプ。" },
  protokoll: { type: "ソウルの韓国型", desc: "Protokollの世界観に惹かれるタイプ。" },
  manufact: { type: "ソウルの韓国型", desc: "Manufact Coffeeの世界観に惹かれるタイプ。" },
  coffeegraffiti: { type: "ソウルの韓国型", desc: "Coffee Graffitiの世界観に惹かれるタイプ。" },
  fiveextracts: { type: "ソウルの韓国型", desc: "Five Extractsの世界観に惹かれるタイプ。" },
  felt: { type: "ソウルの韓国型", desc: "Felt Coffeeの世界観に惹かれるタイプ。" },
  lowkey: { type: "ソウルの韓国型", desc: "Low Keyの世界観に惹かれるタイプ。" },
  mesh: { type: "ソウルの韓国型", desc: "Mesh Coffeeの世界観に惹かれるタイプ。" },
  beanbrothers: { type: "ソウルの韓国型", desc: "Bean Brothersの世界観に惹かれるタイプ。" },
  hellcafe: { type: "ソウルの韓国型", desc: "Hell Cafe Roastersの世界観に惹かれるタイプ。" },
  peer: { type: "ソウルの韓国型", desc: "Peer Coffeeの世界観に惹かれるタイプ。" },
  elcafe: { type: "ソウルの韓国型", desc: "El Cafe Coffeeの世界観に惹かれるタイプ。" },
  seesaw: { type: "上海の中国型", desc: "Seesaw Coffeeの世界観に惹かれるタイプ。" },
  metalhands: { type: "北京の中国型", desc: "Metal Handsの世界観に惹かれるタイプ。" },
  fisheye: { type: "北京の中国型", desc: "Fisheye Coffeeの世界観に惹かれるタイプ。" },
  torch: { type: "昆明の中国型", desc: "Torch Coffeeの世界観に惹かれるタイプ。" },
  mstand: { type: "上海の中国型", desc: "M Standの世界観に惹かれるタイプ。" },
  unicafe: { type: "上海の中国型", desc: "Uni Uniの世界観に惹かれるタイプ。" },
  sumo: { type: "上海の中国型", desc: "Sumo Coffeeの世界観に惹かれるタイプ。" },
  berrybeans: { type: "北京の中国型", desc: "Berry Beansの世界観に惹かれるタイプ。" },
  ops: { type: "上海の中国型", desc: "O.P.S Cafeの世界観に惹かれるタイプ。" },
  greybox: { type: "上海の中国型", desc: "Greybox Coffeeの世界観に惹かれるタイプ。" },
  fluid: { type: "上海の中国型", desc: "Fluid Coffeeの世界観に惹かれるタイプ。" },
  simplekaffa: { type: "台北の台湾型", desc: "Simple Kaffaの世界観に惹かれるタイプ。" },
  fikafika: { type: "台北の台湾型", desc: "Fika Fika Cafeの世界観に惹かれるタイプ。" },
  vwi: { type: "台北の台湾型", desc: "VWI by CHADWANGの世界観に惹かれるタイプ。" },
  peacelove: { type: "台北の台湾型", desc: "Peace & Love Cafeの世界観に惹かれるタイプ。" },
  gabee: { type: "台北の台湾型", desc: "GABEEの世界観に惹かれるタイプ。" },
  rufous: { type: "台北の台湾型", desc: "Rufous Coffeeの世界観に惹かれるタイプ。" },
  coffeestopover: { type: "台中の台湾型", desc: "Coffee Stopoverの世界観に惹かれるタイプ。" },
  congrats: { type: "台北の台湾型", desc: "Congrats Cafeの世界観に惹かれるタイプ。" },
  coffeesind: { type: "台北の台湾型", desc: "Coffee Sindの世界観に惹かれるタイプ。" },
  mojocoffee: { type: "台中の台湾型", desc: "The Factory / Mojocoffeeの世界観に惹かれるタイプ。" },
  blackstar: { type: "台北の台湾型", desc: "Black Star Coffeeの世界観に惹かれるタイプ。" },
  fineprint: { type: "香港の香港型", desc: "Fineprint Coの世界観に惹かれるタイプ。" },
  sensoryzero: { type: "香港の香港型", desc: "Sensory Zeroの世界観に惹かれるタイプ。" },
  winstons: { type: "香港の香港型", desc: "Winstons Coffeeの世界観に惹かれるタイプ。" },
  dutchcolony: { type: "Singaporeのシンガポール型", desc: "Dutch Colony Coffeeの世界観に惹かれるタイプ。" },
  homeground: { type: "Singaporeのシンガポール型", desc: "Homeground Coffeeの世界観に惹かれるタイプ。" },
  alchemist: { type: "Singaporeのシンガポール型", desc: "Alchemistの世界観に惹かれるタイプ。" },
  maxi: { type: "Singaporeのシンガポール型", desc: "Maxi Coffee Barの世界観に惹かれるタイプ。" },
  brave: { type: "Bangkokのタイ型", desc: "Brave Roastersの世界観に惹かれるタイプ。" },
  pacamara: { type: "Bangkokのタイ型", desc: "Pacamara Coffeeの世界観に惹かれるタイプ。" },
  gallerydrip: { type: "Bangkokのタイ型", desc: "Gallery Drip Coffeeの世界観に惹かれるタイプ。" },
  rework: { type: "Bangkokのタイ型", desc: "Rework Coffeeの世界観に惹かれるタイプ。" },
  factory43: { type: "Ho Chi Minhのベトナム型", desc: "43 Factoryの世界観に惹かれるタイプ。" },
  laviet: { type: "Da Latのベトナム型", desc: "La Viet Coffeeの世界観に惹かれるタイプ。" },
  shin: { type: "Ho Chi Minhのベトナム型", desc: "Shin Coffeeの世界観に惹かれるタイプ。" },
  everyhalf: { type: "Ho Chi Minhのベトナム型", desc: "Every Half Coffeeの世界観に惹かれるタイプ。" },
  raaw: { type: "Ho Chi Minhのベトナム型", desc: "RAAW Coffeeの世界観に惹かれるタイプ。" },
  theworkshop: { type: "Ho Chi Minhのベトナム型", desc: "The Workshop Coffeeの世界観に惹かれるタイプ。" },
  blackbird: { type: "Hanoiのベトナム型", desc: "Blackbird Coffeeの世界観に惹かれるタイプ。" },
  tanamera: { type: "Jakartaのインドネシア型", desc: "Tanamera Coffeeの世界観に惹かれるタイプ。" },
  anomali: { type: "Jakartaのインドネシア型", desc: "Anomali Coffeeの世界観に惹かれるタイプ。" },
  expat: { type: "Baliのインドネシア型", desc: "Expat Roastersの世界観に惹かれるタイプ。" },
  firstcrack: { type: "Jakartaのインドネシア型", desc: "First Crackの世界観に惹かれるタイプ。" },
  kina: { type: "Jakartaのインドネシア型", desc: "KINAの世界観に惹かれるタイプ。" },
  commongrounds: { type: "Jakartaのインドネシア型", desc: "Common Groundsの世界観に惹かれるタイプ。" },
  crematology: { type: "Jakartaのインドネシア型", desc: "Crematologyの世界観に惹かれるタイプ。" },
  seniman: { type: "Baliのインドネシア型", desc: "Seniman Coffeeの世界観に惹かれるタイプ。" },
  kopikalyan: { type: "Jakartaのインドネシア型", desc: "Kopikalyanの世界観に惹かれるタイプ。" },
  vcr: { type: "Kuala Lumpurのマレーシア型", desc: "VCRの世界観に惹かれるタイプ。" },
  pulp: { type: "Kuala Lumpurのマレーシア型", desc: "PULP by Papa Palhetaの世界観に惹かれるタイプ。" },
  threelittlebirds: { type: "Kuala Lumpurのマレーシア型", desc: "Three Little Birdsの世界観に惹かれるタイプ。" },
  coffea: { type: "Kuala Lumpurのマレーシア型", desc: "Coffea Coffeeの世界観に惹かれるタイプ。" },
  artisanmy: { type: "Kuala Lumpurのマレーシア型", desc: "Artisan Roasteryの世界観に惹かれるタイプ。" },
  yardstick: { type: "Manilaのフィリピン型", desc: "Yardstick Coffeeの世界観に惹かれるタイプ。" },
  edsa: { type: "Manilaのフィリピン型", desc: "EDSA Beverage Designの世界観に惹かれるタイプ。" },
  kalsada: { type: "Manilaのフィリピン型", desc: "Kalsada Coffeeの世界観に惹かれるタイプ。" },
  habitual: { type: "Manilaのフィリピン型", desc: "Habitual Coffeeの世界観に惹かれるタイプ。" },
  bluetokai: { type: "Delhiのインド型", desc: "Blue Tokaiの世界観に惹かれるタイプ。" },
  thirdwave: { type: "Bangaloreのインド型", desc: "Third Wave Coffeeの世界観に惹かれるタイプ。" },
  kcroasters: { type: "Mumbaiのインド型", desc: "KC Roastersの世界観に惹かれるタイプ。" },
  corridorseven: { type: "Nagpurのインド型", desc: "Corridor Sevenの世界観に惹かれるタイプ。" },
  naivo: { type: "Bangaloreのインド型", desc: "Naivo Cafeの世界観に惹かれるタイプ。" },
};

/* 全ロースター分のスコアを 0 で初期化 */
const initScores = () => Object.fromEntries(Object.keys(ROASTERS).map((k) => [k, 0]));

function DiagnosisView({ onRoaster }) {
  const [step, setStep] = useState(0);
  const [scores, setScores] = useState(initScores);

  const answer = (pts) => {
    const next = { ...scores };
    Object.entries(pts).forEach(([k, v]) => { next[k] += v; });
    setScores(next);
    setStep(step + 1);
  };
  const reset = () => { setStep(0); setScores(initScores()); };

  if (step >= QUESTIONS.length) {
    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const [topId] = sorted[0];
    const top = ROASTERS[topId];
    const t = TYPE_LABEL[topId];
    return (
      <div className="bt-card">
        <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, color: GRAY, letterSpacing: "0.1em" }}>RESULT</div>
        <div style={{ fontSize: 21, fontWeight: 800, marginTop: 6 }}>{t.type}</div>
        <div style={{ fontSize: 12.5, color: GRAY, marginTop: 6, lineHeight: 1.7 }}>{t.desc}</div>

        <div style={{ borderTop: `2px solid ${INK}`, marginTop: 18, paddingTop: 14 }}>
          <div style={{ fontSize: 11, color: GRAY }}>いま一番相性が近いロースター</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 6 }}>
            <div style={{ fontSize: 17, fontWeight: 700 }}>{top.name}</div>
            <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, color: GRAY }}>{top.city}</span>
          </div>
          <div style={{ fontSize: 11.5, color: GRAY, marginTop: 2 }}>{top.note}</div>
          <button onClick={() => onRoaster(topId)}
            style={{ width: "100%", marginTop: 12, padding: "12px 0", background: INK, color: PAPER, border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            この店の豆を見に行く →
          </button>
        </div>

        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 11, color: GRAY, marginBottom: 4 }}>ほかの店との相性</div>
          {sorted.slice(1).map(([rid]) => (
            <button key={rid} onClick={() => onRoaster(rid)}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", background: "none", border: "none", borderTop: `1px solid ${LINE}`, padding: "11px 2px", cursor: "pointer", textAlign: "left" }}>
              <div>
                <span style={{ fontSize: 13, fontWeight: 700, color: INK }}>{ROASTERS[rid].name}</span>
                <span style={{ fontSize: 10.5, color: GRAY, marginLeft: 8 }}>{TYPE_LABEL[rid].type}</span>
              </div>
              <span style={{ color: GRAY }}>→</span>
            </button>
          ))}
        </div>

        <div style={{ marginTop: 16, fontSize: 10, color: GRAY, lineHeight: 1.7, borderTop: `1px solid ${LINE}`, paddingTop: 10 }}>
          この診断はロースターの優劣ではなく、あなたの好みとの相性です。答えが変われば近い店も変わります。
        </div>
        <button onClick={reset} style={{ marginTop: 12, background: "none", border: `1px solid ${LINE}`, borderRadius: 999, padding: "7px 16px", fontSize: 11, color: GRAY, cursor: "pointer" }}>
          もう一度診断する
        </button>
      </div>
    );
  }

  const q = QUESTIONS[step];
  return (
    <div className="bt-card" key={step}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, color: GRAY, letterSpacing: "0.1em" }}>
          Q{step + 1} / {QUESTIONS.length}
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {QUESTIONS.map((_, i) => (
            <span key={i} style={{ width: 14, height: 3, borderRadius: 2, background: i <= step ? INK : LINE }} />
          ))}
        </div>
        <p style={{ fontSize: 12, color: INK, lineHeight: 1.85, marginTop: 12, marginBottom: 0 }}>{roaster.bio}</p>
      </div>
      <div style={{ fontSize: 17, fontWeight: 700, marginTop: 12, lineHeight: 1.5 }}>{q.q}</div>
      <div style={{ marginTop: 16 }}>
        {q.options.map((o) => (
          <button key={o.label} onClick={() => answer(o.pts)}
            style={{
              display: "block", width: "100%", textAlign: "left", padding: "13px 14px", marginTop: 8,
              background: PAPER, border: `1px solid ${LINE}`, borderRadius: 8,
              fontSize: 13, color: INK, cursor: "pointer",
            }}>{o.label}</button>
        ))}
      </div>
      {step > 0 && (
        <button onClick={reset} style={{ marginTop: 14, background: "none", border: "none", fontSize: 11, color: GRAY, cursor: "pointer", padding: 0 }}>
          ← 最初からやり直す
        </button>
      )}
    </div>
  );
}

/* ---------- 味わいマップ ---------- */
const FLAVORS = {
  citrus: { label: "柑橘", color: "#D9B441" },
  floral: { label: "花・お茶", color: "#D98CA6" },
  berry: { label: "ベリー", color: "#7C4D8F" },
  tropical: { label: "トロピカル", color: "#D97E3A" },
  choco: { label: "チョコ・甘み", color: "#7A5232" },
};
/* fx: 0=クリーン ←→ 100=個性派 / fy: 0=明るい ←→ 100=深い */
const FLAVOR_MAP = {
  1: { fx: 32, fy: 20, fam: "citrus", notes: "レモンティー・白い花" },
  2: { fx: 88, fy: 45, fam: "tropical", notes: "ライチ・パイナップル" },
  4: { fx: 45, fy: 14, fam: "berry", notes: "カシス・グレープフルーツ" },
  5: { fx: 22, fy: 52, fam: "choco", notes: "キャラメル・赤リンゴ" },
  6: { fx: 52, fy: 10, fam: "floral", notes: "ジャスミン・ピーチ" },
  8: { fx: 30, fy: 66, fam: "choco", notes: "ミルクチョコ・オレンジ" },
  9: { fx: 70, fy: 40, fam: "berry", notes: "ブルーベリー・カカオ" },
  10: { fx: 60, fy: 60, fam: "choco", notes: "黒糖・プラム" },
  12: { fx: 46, fy: 24, fam: "berry", notes: "カシス・オレンジ" },
  13: { fx: 74, fy: 30, fam: "berry", notes: "ストロベリー・ハニー" },
  24: { fx: 68, fy: 34, fam: "tropical", notes: "マンゴー・ドライアプリコット" },
  25: { fx: 78, fy: 42, fam: "berry", notes: "ラズベリー・完熟プラム" },
  26: { fx: 24, fy: 50, fam: "choco", notes: "プラム・赤リンゴ・黒糖" },
  28: { fx: 82, fy: 38, fam: "berry", notes: "ブルーベリー・カカオニブ" },
  29: { fx: 40, fy: 18, fam: "citrus", notes: "ブラックカラント・トマト" },
  33: { fx: 44, fy: 20, fam: "berry", notes: "ブラッドオレンジ・カシス" },
  34: { fx: 58, fy: 12, fam: "floral", notes: "ジャスミン・白桃・柑橘" },
  35: { fx: 50, fy: 16, fam: "floral", notes: "紅茶・ベルガモット" },
  37: { fx: 48, fy: 22, fam: "berry", notes: "ブラッドオレンジ・プラム" },
  39: { fx: 76, fy: 40, fam: "berry", notes: "ストロベリー・ドライアプリコット" },
  42: { fx: 80, fy: 46, fam: "tropical", notes: "パイナップル・ライチ" },
  43: { fx: 30, fy: 56, fam: "choco", notes: "キャラメル・カカオ・オレンジ" },
  47: { fx: 56, fy: 12, fam: "floral", notes: "ジャスミン・柑橘・白桃" },
  48: { fx: 54, fy: 14, fam: "floral", notes: "花・シトラス・ピーチ" },
  49: { fx: 34, fy: 54, fam: "choco", notes: "ラズベリー・カカオ・黒糖" },
  51: { fx: 80, fy: 40, fam: "berry", notes: "ストロベリー・トロピカル" },
  55: { fx: 46, fy: 16, fam: "floral", notes: "ジャスミン・レモン" },
  57: { fx: 28, fy: 52, fam: "choco", notes: "キャラメル・オレンジ" },
  58: { fx: 74, fy: 34, fam: "berry", notes: "ブルーベリー・ハニー" },
  59: { fx: 90, fy: 44, fam: "tropical", notes: "ライチ・パイナップル" },
  60: { fx: 22, fy: 64, fam: "choco", notes: "ナッツ・ミルクチョコ" },
  62: { fx: 40, fy: 20, fam: "floral", notes: "レモン・ジャスミン・蜂蜜" },
  63: { fx: 46, fy: 18, fam: "berry", notes: "ブラックカラント・トマト" },
  66: { fx: 78, fy: 36, fam: "berry", notes: "ブルーベリー・ぶどう・桃" },
  67: { fx: 60, fy: 10, fam: "floral", notes: "ジャスミン・ラベンダー・杏" },
  70: { fx: 48, fy: 22, fam: "berry", notes: "カシス・ブラッドオレンジ" },
  71: { fx: 26, fy: 50, fam: "choco", notes: "カカオ・オレンジ・黒糖" },
  74: { fx: 80, fy: 44, fam: "tropical", notes: "ストロベリー・トロピカル" },
  75: { fx: 62, fy: 12, fam: "floral", notes: "ジャスミン・ライチ・ローズ" },
  76: { fx: 92, fy: 40, fam: "tropical", notes: "パイナップル・発酵果実" },

  78: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  81: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  84: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  86: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  89: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  91: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  94: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  96: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  99: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  101: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  104: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  106: { fx: 26, fy: 56, fam: "choco", notes: "チョコ・ナッツ・甘み" },
  108: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  111: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  114: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  116: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  118: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  121: { fx: 26, fy: 56, fam: "choco", notes: "チョコ・ナッツ・甘み" },
  124: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  126: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  128: { fx: 26, fy: 56, fam: "choco", notes: "チョコ・ナッツ・甘み" },
  131: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  134: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  136: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  139: { fx: 26, fy: 56, fam: "choco", notes: "チョコ・ナッツ・甘み" },
  141: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  143: { fx: 40, fy: 18, fam: "citrus", notes: "シトラス・ハーブ" },
  146: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  148: { fx: 26, fy: 56, fam: "choco", notes: "チョコ・ナッツ・甘み" },
  151: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  153: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  155: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  157: { fx: 40, fy: 18, fam: "citrus", notes: "シトラス・ハーブ" },
  160: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  162: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  164: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  166: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  168: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  170: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  172: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  174: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  176: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  178: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  180: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  182: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  184: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  186: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  188: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  190: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  192: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  194: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  196: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  198: { fx: 26, fy: 56, fam: "choco", notes: "チョコ・ナッツ・甘み" },
  200: { fx: 26, fy: 56, fam: "choco", notes: "チョコ・ナッツ・甘み" },
  202: { fx: 26, fy: 56, fam: "choco", notes: "チョコ・ナッツ・甘み" },
  204: { fx: 26, fy: 56, fam: "choco", notes: "チョコ・ナッツ・甘み" },
  206: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  208: { fx: 26, fy: 56, fam: "choco", notes: "チョコ・ナッツ・甘み" },
  210: { fx: 26, fy: 56, fam: "choco", notes: "チョコ・ナッツ・甘み" },
  212: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  214: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  216: { fx: 26, fy: 56, fam: "choco", notes: "チョコ・ナッツ・甘み" },
  218: { fx: 26, fy: 56, fam: "choco", notes: "チョコ・ナッツ・甘み" },
  220: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  222: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  224: { fx: 26, fy: 56, fam: "choco", notes: "チョコ・ナッツ・甘み" },
  226: { fx: 26, fy: 56, fam: "choco", notes: "チョコ・ナッツ・甘み" },
  228: { fx: 26, fy: 56, fam: "choco", notes: "チョコ・ナッツ・甘み" },
  230: { fx: 26, fy: 56, fam: "choco", notes: "チョコ・ナッツ・甘み" },
  232: { fx: 26, fy: 56, fam: "choco", notes: "チョコ・ナッツ・甘み" },
  234: { fx: 26, fy: 56, fam: "choco", notes: "チョコ・ナッツ・甘み" },
  236: { fx: 26, fy: 56, fam: "choco", notes: "チョコ・ナッツ・甘み" },
  238: { fx: 26, fy: 56, fam: "choco", notes: "チョコ・ナッツ・甘み" },
  241: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  243: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  245: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  247: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  249: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  251: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  253: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  255: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  257: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  259: { fx: 26, fy: 56, fam: "choco", notes: "チョコ・ナッツ・甘み" },
  261: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  263: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  265: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  267: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  269: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  271: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  273: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  275: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  277: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  279: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  281: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  283: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  285: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  287: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  289: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  291: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  293: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  295: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  297: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  299: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  301: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  303: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  305: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  307: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  309: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  311: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  313: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  315: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  317: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  319: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  321: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  323: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  325: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  327: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  329: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  331: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  333: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  335: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  337: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  339: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  341: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  343: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  345: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  347: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  349: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  351: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  354: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  356: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  358: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  360: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  362: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  364: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  366: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  368: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  370: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  372: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  374: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  376: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  378: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  380: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  382: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  384: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  386: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  388: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  390: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  392: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  394: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  397: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  399: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  401: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  403: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  405: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  407: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  409: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  411: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  414: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  416: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  418: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  420: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  422: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  425: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  427: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  429: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  431: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  434: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  436: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  438: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  440: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  442: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  444: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  446: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  448: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  450: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  452: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  454: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  456: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  458: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  460: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  462: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  464: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  466: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  468: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  470: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  472: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  474: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  476: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  478: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  480: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  482: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  484: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  486: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  488: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  490: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  492: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  494: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  496: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  498: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  500: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  502: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  504: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  506: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  508: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  510: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  512: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  514: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  516: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  518: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  520: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  522: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  524: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  526: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  529: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  531: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  533: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  535: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  537: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  539: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  541: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  543: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  545: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  547: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  549: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  551: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  553: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  555: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  557: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  559: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  561: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  563: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  565: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  567: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  569: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  571: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  573: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  575: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  577: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  579: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  581: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  583: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  585: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  587: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  589: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  591: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  593: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  595: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  597: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  599: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  601: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  603: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  605: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  607: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  609: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  611: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  613: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  615: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  617: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  619: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  621: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  623: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  625: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
  627: { fx: 50, fy: 22, fam: "berry", notes: "ベリー・カシス" },
  629: { fx: 52, fy: 14, fam: "floral", notes: "ジャスミン・柑橘" },
};

function FlavorMapView({ onOpen, cur }) {
  const [famF, setFamF] = useState(null);     // 系統ハイライト
  const [selId, setSelId] = useState(null);   // 選択中の豆
  const beans = BEANS.filter((b) => FLAVOR_MAP[b.id]);
  const sel = beans.find((b) => b.id === selId);

  return (
    <div>
      <div style={{ fontSize: 11, color: GRAY, marginBottom: 10 }}>
        いま買える豆を、味わいの座標で。●をタップすると豆の詳細が出ます。
      </div>

      {/* 系統の凡例（タップでハイライト） */}
      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8, WebkitOverflowScrolling: "touch" }}>
        {Object.entries(FLAVORS).map(([k, f]) => (
          <button key={k} onClick={() => setFamF(famF === k ? null : k)}
            style={{
              flexShrink: 0, display: "flex", alignItems: "center", gap: 5,
              padding: "5px 11px", borderRadius: 999, fontSize: 11, cursor: "pointer",
              border: `1px solid ${famF === k ? f.color : LINE}`,
              background: famF === k ? f.color : "transparent",
              color: famF === k ? "#fff" : INK,
              transition: "all 0.2s ease",
            }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: famF === k ? "#fff" : f.color }} />
            {f.label}
          </button>
        ))}
      </div>

      {/* マップ本体 */}
      <div style={{ position: "relative", width: "100%", aspectRatio: "1 / 1", marginTop: 6,
        borderRadius: 12, border: `1.4px solid ${INK}`, overflow: "hidden",
        background: `
          radial-gradient(at 15% 12%, rgba(217,180,65,0.13), transparent 55%),
          radial-gradient(at 85% 12%, rgba(217,140,166,0.14), transparent 55%),
          radial-gradient(at 85% 88%, rgba(124,77,143,0.12), transparent 55%),
          radial-gradient(at 15% 88%, rgba(122,82,50,0.13), transparent 55%),
          #FCFBF8` }}>
        {/* 十字の補助線 */}
        <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: LINE }} />
        <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 1, background: LINE }} />
        {/* 軸ラベル */}
        <span style={{ position: "absolute", top: 6, left: "50%", transform: "translateX(-50%)", fontSize: 9, color: GRAY, letterSpacing: "0.15em" }}>明るい・すっきり</span>
        <span style={{ position: "absolute", bottom: 6, left: "50%", transform: "translateX(-50%)", fontSize: 9, color: GRAY, letterSpacing: "0.15em" }}>深い・コク</span>
        <span style={{ position: "absolute", left: 8, top: "50%", transform: "translate(-30%, -50%) rotate(-90deg)", fontSize: 9, color: GRAY, letterSpacing: "0.15em" }}>クリーン</span>
        <span style={{ position: "absolute", right: 8, top: "50%", transform: "translate(30%, -50%) rotate(90deg)", fontSize: 9, color: GRAY, letterSpacing: "0.15em" }}>個性派</span>

        {/* 豆のドット */}
        {beans.map((b, i) => {
          const m = FLAVOR_MAP[b.id];
          const f = FLAVORS[m.fam];
          const dimmed = famF && famF !== m.fam;
          const isSel = selId === b.id;
          return (
            <button key={b.id} onClick={() => setSelId(isSel ? null : b.id)}
              className="bt-dot"
              style={{
                position: "absolute", left: `${m.fx}%`, top: `${m.fy}%`,
                width: 30, height: 30, marginLeft: -15, marginTop: -15,
                background: "transparent", border: "none", cursor: "pointer", padding: 0,
                animationDelay: `${0.35 + i * 0.06}s`,
                opacity: dimmed ? 0.15 : 1,
                transition: "opacity 0.25s ease",
                zIndex: isSel ? 5 : 1,
              }}>
              <span className={isSel ? "bt-dot-core bt-dot-sel" : "bt-dot-core"}
                style={{
                  display: "block", width: 14, height: 14, margin: "8px auto",
                  borderRadius: 999,
                  background: b.status === "sold" ? "transparent" : f.color,
                  border: `3px solid ${f.color}`,
                  boxShadow: isSel ? `0 0 0 5px ${f.color}33` : "0 1px 3px rgba(23,21,15,0.2)",
                  animationDelay: `${i * 0.4}s`,
                }} />
            </button>
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9.5, color: GRAY, marginTop: 6 }}>
        <span>● 在庫あり　○ 売り切れ</span>
        <span>座標は精製・焙煎からの位置づけ（優劣ではありません）</span>
      </div>

      {/* 選択中の豆カード */}
      {sel && (
        <div className="bt-card" key={sel.id} style={{ display: "flex", gap: 14, borderTop: `2px solid ${INK}`, marginTop: 12, paddingTop: 14 }}>
          <div style={{ width: 84, flexShrink: 0 }}><Package bean={sel} small /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 9, height: 9, borderRadius: 999, background: FLAVORS[FLAVOR_MAP[sel.id].fam].color }} />
              <span style={{ fontSize: 10.5, color: GRAY }}>{FLAVORS[FLAVOR_MAP[sel.id].fam].label} — {FLAVOR_MAP[sel.id].notes}</span>
            </div>
            <div style={{ fontSize: 14.5, fontWeight: 700, marginTop: 4 }}>{sel.name}</div>
            <div style={{ fontSize: 11, color: GRAY, marginTop: 2 }}>
              {ROASTERS[sel.r].name} ・ {STATUS[sel.status].jp} ・ {fmtPrice(sel, cur)}/{perGrams(sel)}g
            </div>
            <button onClick={() => onOpen(sel)}
              style={{ marginTop: 10, padding: "9px 18px", background: INK, color: PAPER, border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              詳しく見る →
            </button>
          </div>
        </div>
      )}
      {!sel && (
        <div style={{ textAlign: "center", fontSize: 10.5, color: GRAY, marginTop: 14 }}>
          右上ほど個性的で明るく、左下ほどクラシックで深い味わいです
        </div>
      )}
    </div>
  );
}

/* ---------- レアロット ---------- */
function VarietySection({ vt, title, sub, onOpen, cur }) {
  const all = BEANS.filter((b) => b.vt === vt);
  const live = all.filter((b) => b.status === "now");
  const soldNow = all.filter((b) => b.status === "sold");
  const arc = all.filter((b) => b.status === "archive");
  const per100 = (b) => (toJPY(b) / perGrams(b)) * 100;
  const fmt100 = (b) => cur === "JPY" ? `¥${Math.round(per100(b)).toLocaleString()}` : `$${(per100(b) / RATES_TO_JPY.USD).toFixed(0)}`;
  const ladder = [...live, ...soldNow].sort((a, b) => per100(a) - per100(b));
  const maxP = Math.max(...ladder.map(per100));
  const years = [...new Set(arc.map((b) => b.year))].sort((a, b) => b - a);

  return (
    <div style={{ marginTop: 26 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: "0.08em" }}>{title}</span>
        <span style={{ fontSize: 10, color: GRAY }}>{sub}</span>
      </div>

      {/* ライブカウンター */}
      <div style={{ borderTop: `2px solid ${INK}`, borderBottom: `1px solid ${LINE}`, padding: "12px 0", marginTop: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="bt-live" style={{ width: 8, height: 8, borderRadius: 999, background: GREEN }} />
          <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, letterSpacing: "0.15em", color: GRAY }}>LIVE</span>
        </div>
        <div style={{ fontSize: 19, fontWeight: 800, marginTop: 5 }}>
          いま世界で買える <span style={{ fontFamily: "ui-monospace, monospace" }}>{live.length}</span> 銘柄
        </div>
      </div>

      {/* 100gあたり価格軸 */}
      <div style={{ marginTop: 14 }}>
        <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, letterSpacing: "0.12em", color: GRAY }}>
          PRICE / 100g
        </div>
        {ladder.map((b, i) => (
          <button key={b.id} onClick={() => onOpen(b)}
            style={{ display: "block", width: "100%", background: "none", border: "none", padding: "10px 0 0", cursor: "pointer", textAlign: "left" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: INK }}>
                {b.status === "sold" && <span style={{ color: AMBER, fontSize: 9, fontFamily: "ui-monospace, monospace", marginRight: 6 }}>SOLD OUT</span>}
                {b.name}
              </span>
              <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: INK }}>{fmt100(b)}</span>
            </div>
            <div style={{ fontSize: 10, color: GRAY, marginTop: 1 }}>{ROASTERS[b.r].name} ・ {b.origin} ・ {b.process}</div>
            <div style={{ height: 6, background: "#F0EDE4", borderRadius: 3, marginTop: 5, overflow: "hidden" }}>
              <div className="bt-bar" style={{
                height: "100%", borderRadius: 3,
                width: `${(per100(b) / maxP) * 100}%`,
                background: b.status === "sold" ? LINE : `linear-gradient(90deg, ${GREEN}, #6B8F3C)`,
                animationDelay: `${0.15 + i * 0.09}s`,
              }} />
            </div>
          </button>
        ))}
      </div>

      {/* アーカイブ年表 */}
      {arc.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, letterSpacing: "0.12em", color: GRAY, borderBottom: `1px solid ${LINE}`, paddingBottom: 6 }}>
            {title} ARCHIVE — 消えたロットの記録
          </div>
          {years.map((yr) => (
            <div key={yr} style={{ display: "flex", gap: 14, marginTop: 12 }}>
              <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 13, fontWeight: 700, color: GRAY, width: 42, flexShrink: 0, paddingTop: 2 }}>{yr}</div>
              <div style={{ flex: 1 }}>
                {arc.filter((b) => b.year === yr).map((b) => (
                  <button key={b.id} onClick={() => onOpen(b)}
                    style={{ display: "flex", gap: 10, width: "100%", background: "none", border: "none", padding: "0 0 12px", cursor: "pointer", textAlign: "left", alignItems: "center" }}>
                    <div style={{ width: 34, flexShrink: 0 }}><Package bean={b} small /></div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: INK }}>{b.name}</div>
                      <div style={{ fontSize: 10, color: GRAY }}>{ROASTERS[b.r].name} ・ {b.origin} ・ {b.process}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GeishaView({ onOpen, onRoaster, cur }) {
  return (
    <div>
      {/* ページヘッダー */}
      <div>
        <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, letterSpacing: "0.2em", color: GRAY }}>RARE LOT</div>
        <div style={{ fontSize: 12, color: GRAY, marginTop: 4, lineHeight: 1.7 }}>
          少量で消えていく希少な豆だけを追いかけるトラッカー。
        </div>
      </div>

      <VarietySection vt="geisha" title="GEISHA" sub="ゲイシャ品種" onOpen={onOpen} cur={cur} />
      <VarietySection vt="sidra" title="SIDRA" sub="シドラ品種" onOpen={onOpen} cur={cur} />

      {/* 新着通知CTA */}
      <div style={{ marginTop: 24, padding: "14px 16px", background: "#F2F0E9", borderRadius: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>🔔 世界のどこかでレアロットが出たら、すぐ知る</div>
        <div style={{ fontSize: 11, color: GRAY, marginTop: 4, lineHeight: 1.7 }}>
          巡回が新しいゲイシャやシドラを見つけた瞬間に通知します。少量ロットの売り切れ前に。
        </div>
        <button style={{ marginTop: 10, padding: "10px 18px", background: INK, color: PAPER, border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
          新着レアロット通知を受け取る<span style={{ fontSize: 9.5, fontWeight: 400, marginLeft: 8, opacity: 0.7 }}>プレミアム(v2)</span>
        </button>
      </div>

      {/* 今後のセクション予告 */}
      <div style={{ marginTop: 20, padding: "12px 14px", border: `1px dashed ${LINE}`, borderRadius: 10, fontSize: 11, color: GRAY, lineHeight: 1.8 }}>
        このタブは今後、AUCTION LOT(オークションロット)や COE(カップ・オブ・エクセレンス)入賞ロットなど、セクションを増やして育っていきます。
      </div>
    </div>
  );
}

/* ---------- メイン ---------- */
export default function BeanTracker() {
  const [view, setView] = useState("zukan"); // zukan | roaster
  const [roasterId, setRoasterId] = useState(null);
  const [roasterTab, setRoasterTab] = useState("now");
  const [origin, setOrigin] = useState("すべて");
  const [statusF, setStatusF] = useState("all");
  const [open, setOpen] = useState(null);
  const [displayCur, setDisplayCur] = useState("JPY");
  const [priceF, setPriceF] = useState("all");
  const [processF, setProcessF] = useState("すべて");
  const [splashDone, setSplashDone] = useState(false);
  const [splashGone, setSplashGone] = useState(false);
  const [fx, setFx] = useState({ live: false, loading: true, error: false, at: null, date: null, source: null });
  const [fxVersion, setFxVersion] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setSplashDone(true), 1700);   // 表示を終えてフェード開始
    const t2 = setTimeout(() => setSplashGone(true), 2400);   // 完全に取り除く
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  // ライブ為替: 起動時に取得 → 10分ごと＋タブ復帰/フォーカス時に再取得して変動を自動反映
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const { rates, date, source } = await fetchLiveRates();
        if (!alive) return;
        Object.assign(RATES_TO_JPY, rates);           // その場で上書き → 全表示が新レートで再計算
        setFx({ live: true, loading: false, error: false, at: new Date(), date, source });
        setFxVersion((v) => v + 1);                   // 価格表示・帯フィルタを再描画
      } catch {
        if (!alive) return;
        setFx((p) => (p.live ? { ...p } : { ...p, loading: false, error: true }));
      }
    };
    load();
    const id = setInterval(load, 10 * 60 * 1000);
    const onVis = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", load);
    return () => {
      alive = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", load);
    };
  }, []);

  const fxTime = fx.at
    ? `${String(fx.at.getHours()).padStart(2, "0")}:${String(fx.at.getMinutes()).padStart(2, "0")}`
    : "";
  const fxTitle = fx.live
    ? `1 USD = ¥${RATES_TO_JPY.USD.toFixed(1)} / 1 EUR = ¥${RATES_TO_JPY.EUR.toFixed(1)} / 1 AUD = ¥${RATES_TO_JPY.AUD.toFixed(1)}（出典: ${fx.source}${fx.date ? " · " + fx.date : ""}）`
    : "為替APIに接続できないため固定値で表示中";

  const goRoaster = (rid, tab) => { setRoasterId(rid); setRoasterTab(tab || "now"); setView("roaster"); window.scrollTo(0, 0); };

  const PRICE_BANDS = {
    all: { label: displayCur === "JPY" ? "すべての価格" : "All prices", test: () => true },
    low: { label: displayCur === "JPY" ? "〜¥2,000" : "〜$13", test: (jpy) => jpy < 2000 },
    mid: { label: displayCur === "JPY" ? "¥2,000〜3,000" : "$13〜20", test: (jpy) => jpy >= 2000 && jpy < 3000 },
    high: { label: displayCur === "JPY" ? "¥3,000〜" : "$20〜", test: (jpy) => jpy >= 3000 },
  };

  const PROCESSES = ["すべて", "Washed", "Natural", "Honey", "Anaerobic"];

  const filtered = useMemo(() => BEANS.filter((b) =>
    (origin === "すべて" || b.origin === origin) &&
    (statusF === "all" || b.status === statusF) &&
    (processF === "すべて" || b.process.includes(processF)) &&
    PRICE_BANDS[priceF].test(toJPY(b))
  ), [origin, statusF, priceF, processF, displayCur, fxVersion]);

  return (
    <div style={{ minHeight: "100vh", background: PAPER, fontFamily: `"Hiragino Kaku Gothic ProN", "Hiragino Sans", "Noto Sans JP", sans-serif`, color: INK }}>
      <style>{`
        @keyframes btTrackIn { from { letter-spacing: 0.8em; opacity: 0; } to { letter-spacing: 0.35em; opacity: 1; } }
        @keyframes btLineGrow { from { width: 0; } to { width: 180px; } }
        @keyframes btFadeUp { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        @keyframes btFadeOut { from { opacity: 1; } to { opacity: 0; } }
        @keyframes btSheetUp { from { transform: translateY(100%); } to { transform: none; } }
        @keyframes btGridIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        .bt-mark { animation: btTrackIn 0.9s cubic-bezier(0.2, 0.7, 0.3, 1) both; }
        .bt-line { animation: btLineGrow 0.7s 0.5s cubic-bezier(0.2, 0.7, 0.3, 1) both; }
        .bt-tag { animation: btFadeUp 0.6s 0.9s ease both; }
        .bt-splash-out { animation: btFadeOut 0.6s ease both; }
        .bt-sheet { animation: btSheetUp 0.32s cubic-bezier(0.2, 0.7, 0.3, 1) both; }
        .bt-card { animation: btGridIn 0.45s ease backwards; transition: transform 0.15s cubic-bezier(0.2, 0.7, 0.3, 1); }
        .bt-card:active { transform: scale(0.955); }
        @keyframes btPkgIn { from { opacity: 0; transform: scale(0.9) translateY(4px); } to { opacity: 1; transform: none; } }
        .bt-detail-pkg { animation: btPkgIn 0.4s 0.08s cubic-bezier(0.2, 0.7, 0.3, 1) backwards; }
        .bt-detail-info { animation: btFadeUp 0.4s 0.16s ease backwards; }
        @keyframes btDotIn { 0% { opacity: 0; transform: scale(0); } 70% { transform: scale(1.25); } 100% { opacity: 1; transform: scale(1); } }
        @keyframes btFloat { from { transform: translateY(-1.5px); } to { transform: translateY(1.5px); } }
        .bt-dot { animation: btDotIn 0.5s cubic-bezier(0.2, 0.7, 0.3, 1) backwards; }
        .bt-dot-core { animation: btFloat 2.4s ease-in-out infinite alternate; }
        .bt-dot-sel { animation: none; }
        @keyframes btBarGrow { from { width: 0; } }
        .bt-bar { animation: btBarGrow 0.8s cubic-bezier(0.2, 0.7, 0.3, 1) backwards; }
        @keyframes btLivePulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.25; } }
        .bt-live { animation: btLivePulse 1.6s ease-in-out infinite; }
      `}</style>
      {!splashGone && <Splash done={splashDone} />}
      {/* ヘッダー */}
      <header style={{ position: "sticky", top: 0, zIndex: 40, background: PAPER, borderBottom: `2px solid ${INK}` }}>
        <div style={{ maxWidth: 640, margin: "0 auto", padding: "14px 16px 10px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div style={{ fontWeight: 800, fontSize: 17, letterSpacing: "0.12em" }}>BEAN&nbsp;TRACKER</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ display: "flex", border: `1px solid ${INK}`, borderRadius: 6, overflow: "hidden" }}>
                {[["JPY", "¥"], ["USD", "$"]].map(([k, sym]) => (
                  <button key={k} onClick={() => setDisplayCur(k)}
                    style={{
                      padding: "3px 10px", border: "none", cursor: "pointer",
                      fontFamily: "ui-monospace, monospace", fontSize: 11, fontWeight: 700,
                      background: displayCur === k ? INK : "transparent",
                      color: displayCur === k ? PAPER : INK,
                    }}>{sym}</button>
                ))}
              </div>
              <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 9, color: GRAY }}>v0.1</div>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 2 }}>
            <div style={{ fontSize: 10, color: GRAY }}>世界中のコーヒー豆に辿り着くためのインフラ</div>
            <div title={fxTitle} style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0, fontFamily: "ui-monospace, monospace", fontSize: 9, color: GRAY, whiteSpace: "nowrap" }}>
              <span className={fx.live ? "bt-live" : ""} style={{ width: 6, height: 6, borderRadius: 999, background: fx.live ? GREEN : (fx.error ? "#B8433A" : "#C8B36A") }} />
              {fx.live ? `為替LIVE · ${fxTime}更新` : fx.loading ? "為替 取得中…" : "為替 固定値"}
            </div>
          </div>
          <div style={{ display: "flex", gap: 16, marginTop: 10, overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
            {[["zukan", "図鑑"], ["map", "地球"], ["shindan", "診断"], ["flavor", "味わい"], ["geisha", "レアロット"]].map(([k, l]) => (
              <button key={k} onClick={() => setView(k)}
                style={{
                  background: "none", border: "none", padding: "0 0 6px", cursor: "pointer",
                  fontSize: 12.5, letterSpacing: "0.12em", whiteSpace: "nowrap", flexShrink: 0,
                  color: view === k || (k === "zukan" && view === "roaster") ? INK : GRAY,
                  fontWeight: view === k || (k === "zukan" && view === "roaster") ? 700 : 400,
                  borderBottom: view === k || (k === "zukan" && view === "roaster") ? `2px solid ${INK}` : "2px solid transparent",
                }}>{l}</button>
            ))}
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 640, margin: "0 auto", padding: "16px 16px 60px" }}>
        {view === "roaster" && roasterId ? (
          <RoasterPage key={roasterId + roasterTab} rid={roasterId} initialTab={roasterTab} onOpen={setOpen} onBack={() => setView("zukan")} onRoaster={goRoaster} cur={displayCur} />
        ) : view === "map" ? (
          <GlobeView onRoaster={goRoaster} />
        ) : view === "shindan" ? (
          <DiagnosisView onRoaster={goRoaster} />
        ) : view === "flavor" ? (
          <FlavorMapView onOpen={setOpen} cur={displayCur} />
        ) : view === "geisha" ? (
          <GeishaView onOpen={setOpen} onRoaster={goRoaster} cur={displayCur} />
        ) : (
          <>
            {/* フィルタ */}
            <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, WebkitOverflowScrolling: "touch" }}>
              {ORIGINS.map((o) => (
                <button key={o} onClick={() => setOrigin(o)}
                  style={{
                    flexShrink: 0, padding: "6px 12px", borderRadius: 999, fontSize: 11.5, cursor: "pointer",
                    border: `1px solid ${origin === o ? INK : LINE}`,
                    background: origin === o ? INK : "transparent",
                    color: origin === o ? PAPER : INK,
                  }}>{o}</button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingTop: 8, paddingBottom: 4, WebkitOverflowScrolling: "touch" }}>
              {Object.entries(PRICE_BANDS).map(([k, band]) => (
                <button key={k} onClick={() => setPriceF(k)}
                  style={{
                    flexShrink: 0, padding: "5px 11px", borderRadius: 999, fontSize: 11, cursor: "pointer",
                    fontFamily: "ui-monospace, monospace",
                    border: `1px solid ${priceF === k ? INK : LINE}`,
                    background: priceF === k ? INK : "transparent",
                    color: priceF === k ? PAPER : GRAY,
                  }}>{band.label}</button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingTop: 6, paddingBottom: 4, WebkitOverflowScrolling: "touch" }}>
              {PROCESSES.map((p) => (
                <button key={p} onClick={() => setProcessF(p)}
                  style={{
                    flexShrink: 0, padding: "5px 11px", borderRadius: 999, fontSize: 11, cursor: "pointer",
                    fontFamily: p === "すべて" ? "inherit" : "ui-monospace, monospace",
                    letterSpacing: p === "すべて" ? 0 : "0.04em",
                    border: `1px solid ${processF === p ? GREEN : LINE}`,
                    background: processF === p ? GREEN : "transparent",
                    color: processF === p ? PAPER : GRAY,
                  }}>{p === "すべて" ? "全精製" : p}</button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 14, marginTop: 12, borderBottom: `1px solid ${LINE}`, paddingBottom: 8 }}>
              {[["all", "すべて"], ["now", "NOW"], ["sold", "SOLD OUT"], ["archive", "ARCHIVE"]].map(([k, l]) => (
                <button key={k} onClick={() => setStatusF(k)}
                  style={{
                    background: "none", border: "none", padding: 0, cursor: "pointer",
                    fontFamily: "ui-monospace, monospace", fontSize: 10.5, letterSpacing: "0.05em",
                    color: statusF === k ? INK : GRAY, fontWeight: statusF === k ? 700 : 400,
                    borderBottom: statusF === k ? `2px solid ${INK}` : "2px solid transparent", paddingBottom: 6,
                  }}>{l}</button>
              ))}
              <div style={{ marginLeft: "auto", fontFamily: "ui-monospace, monospace", fontSize: 10, color: GRAY, alignSelf: "center" }}>{filtered.length} 銘柄</div>
            </div>
            {statusF === "archive" ? (
              /* ARCHIVE: ロースターを選んで歴代ポートフォリオへ */
              <div style={{ marginTop: 18 }}>
                <div style={{ fontSize: 11, color: GRAY, marginBottom: 12 }}>
                  ロースターを選ぶと、その店の歴代ポートフォリオが開きます。
                </div>
                {Object.entries(ROASTERS).map(([rid, r]) => {
                  const arc = BEANS.filter((b) => b.r === rid && b.status === "archive");
                  if (arc.length === 0) return null;
                  const years = arc.map((b) => Number(b.year));
                  return (
                    <button key={rid} onClick={() => goRoaster(rid, "archive")}
                      style={{
                        display: "flex", alignItems: "center", width: "100%", gap: 12,
                        background: "none", border: "none", borderTop: `1px solid ${LINE}`,
                        padding: "14px 2px", cursor: "pointer", textAlign: "left",
                      }}>
                      {/* ミニ標本プレビュー */}
                      <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
                        {arc.slice(0, 3).map((b) => (
                          <div key={b.id} style={{ width: 20, height: 27, borderRadius: 2, background: b.color, filter: "grayscale(0.55)", opacity: 0.85 }} />
                        ))}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: INK }}>{r.name}</div>
                        <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, color: GRAY, marginTop: 2 }}>
                          {Math.min(...years)}–{Math.max(...years)} / {arc.length} 銘柄
                        </div>
                      </div>
                      <span style={{ color: GRAY, fontSize: 14 }}>→</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <>
                {/* グリッド図鑑 */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 16, marginTop: 18 }}>
                  {filtered.map((b) => <BeanCard key={b.id} bean={b} onOpen={setOpen} onRoaster={goRoaster} cur={displayCur} />)}
                </div>
                {filtered.length === 0 && (
                  <div style={{ textAlign: "center", color: GRAY, fontSize: 12, padding: "50px 0" }}>該当する豆がありません。フィルタを変えてみてください。</div>
                )}
              </>
            )}
            {/* フッター注記 */}
            <div style={{ marginTop: 36, borderTop: `1px solid ${LINE}`, paddingTop: 14, fontSize: 10.5, color: GRAY, lineHeight: 1.7 }}>
              パッケージは実画像の代わりの試作表示です。実装では巡回システムが取得した実際のパッケージ画像が入ります。
              評価機能はありません — この図鑑は探して辿り着くためのインフラです。 円⇄ドル換算はライブ為替（対応時）を用い、変動を自動反映します。取得できない環境では固定値にフォールバックします。
            </div>
          </>
        )}
      </main>

      <DetailSheet bean={open} onClose={() => setOpen(null)} onRoaster={goRoaster} cur={displayCur} />
    </div>
  );
}
