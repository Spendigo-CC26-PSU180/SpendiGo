# Spending DNA Icons

Taruh icon di folder ini dengan nama file sesuai `dna_type` dari API.

## Format
- Format: PNG atau SVG
- Ukuran rekomendasi: 128x128px atau 256x256px
- Nama file: `{dna_type}.png` atau `{dna_type}.svg`

## Daftar Icon yang Dibutuhkan

| DNA Type | Filename | Label | Deskripsi |
|----------|----------|-------|-----------|
| `hustler` | `hustler.png` | Si Hustler | Multiple income sources, cuan dari mana-mana |
| `investor` | `investor.png` | Si Investor | Ada alokasi investasi >10% |
| `saver` | `saver.png` | Si Penabung | Saving rate >50% |
| `gamer` | `gamer.png` | Si Gamer | Top up game >25% spending |
| `foodie` | `foodie.png` | Si Foodie | Makan/kopi >40% spending |
| `shopaholic` | `shopaholic.png` | Si Shopaholic | Belanja online/fashion >35% |
| `social` | `social.png` | Si Gaul | Nongkrong/hiburan >30% |
| `survivor` | `survivor.png` | Si Survivor | Spending 90-100% tapi survive |
| `hedonist` | `hedonist.png` | Si Hedonist | Spending >100% (overspending) |
| `impulsive` | `impulsive.png` | Si Impulsif | High variance, spontan buyer |
| `minimalist` | `minimalist.png` | Si Minimalis | <10 transaksi, low spending |
| `planner` | `planner.png` | Si Planner | Consistent spending, good savings |
| `balanced` | `balanced.png` | Si Seimbang | Default, healthy ratio |

## Contoh Penggunaan di Frontend

```jsx
const dnaType = 'foodie';
const iconPath = `/icons/dna/${dnaType}.png`;

<img src={iconPath} alt={dnaType} />
```

## Ide Visual untuk Setiap DNA

| DNA Type | Ide Visual |
|----------|------------|
| hustler | Orang dengan multiple gadget/laptop, money signs |
| investor | Chart naik, coins/piggy bank |
| saver | Celengan/safe, coins stack |
| gamer | Controller/joystick, game character |
| foodie | Makanan, sendok garpu, chef hat |
| shopaholic | Shopping bags, cart, sale tag |
| social | People hanging out, coffee cups |
| survivor | Person climbing, survival gear |
| hedonist | Party, confetti, celebration |
| impulsive | Lightning bolt, random items |
| minimalist | Zen, simple lines, empty space |
| planner | Calendar, checklist, organized |
| balanced | Yin-yang, scales, harmony |
