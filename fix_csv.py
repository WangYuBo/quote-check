"""
修复校对结果 CSV：重校有 bib 的引用 + 标记俗语/现代表述

用法:
    python fix_csv.py mark     # 任务2: 标记46条俗语/现代表述 (秒完成)
    python fix_csv.py recheck  # 任务1: 重校84条有bib的引用 (调API)
    python fix_csv.py merge    # 合并两个结果为最终版
"""

import asyncio
import csv
import os
import re
import sys
from pathlib import Path

# 确保 print 立即输出（避免缓冲导致看不到进度）
sys.stdout.reconfigure(line_buffering=True)

# 项目根目录
ROOT = Path(__file__).parent
BIB_DIR = ROOT / "bib"
CSV_INPUT = ROOT / "260319-幺弟解惑-引用校对结果.csv"
CSV_RECHECK = ROOT / "260319-幺弟解惑-引用校对结果-重校.csv"
CSV_MARKED = ROOT / "260319-幺弟解惑-引用校对结果-标记.csv"
CSV_FINAL = ROOT / "260319-幺弟解惑-引用校对结果-修复版.csv"

# bib 文件映射 (典籍名 → 文件名前缀)
BIB_FILES = {
    "大学中庸": "Da Xue Zhong Yong Ping Shi",
    "黄帝内经": "Huang Di Nei Jing",
    "论语": "Lun Yu Yi Zhu",
    "孟子": "Meng Zi Yi Zhu",
    "诗经": "Shi Jing Yi Zhu",
    "周易": "Zhou Yi Jin Zhu",
    "庄子": "Zhuang Zi",
    "孙子兵法": "Sun Zi Bing Fa",
}


def _find_bib_file(book_key: str) -> Path | None:
    """根据典籍名找到 bib 目录中的文件"""
    prefix = BIB_FILES.get(book_key, "")
    if not prefix:
        return None
    for f in BIB_DIR.iterdir():
        if f.name.startswith(prefix):
            return f
    return None


def _read_bib(book_key: str) -> str | None:
    """读取 bib 文件内容"""
    from app.services.file_parser import parse_file
    path = _find_bib_file(book_key)
    if not path:
        return None
    return parse_file(str(path))


# ============================================================
# 引用→典籍 匹配规则
# ============================================================

def _match_quote_to_book(seq: int, quote: str) -> str | None:
    """
    根据序号和引用文字判断属于哪本典籍。
    返回典籍名（BIB_FILES 的 key），或 None 表示无法匹配。
    """
    # --- 先排除 "假引用"：提到经典但不是实际引文 ---
    if "你多读读" in quote or "你只要学到" in quote:
        return None  # #588 只是提到诗经，不是引用
    if quote.startswith("\u2014\u2014\u300a"):  # ——《
        return None  # #598 只是出处标注
    if re.search(r'出版社|版\s|全\d+册|注疏', quote) and len(quote) < 40:
        return None  # #627 书目信息

    # --- 按序号范围匹配 ---
    # 大学中庸 (#367-392)
    if 367 <= seq <= 392:
        return "大学中庸"
    # 黄帝内经 (#507-514)
    if 507 <= seq <= 514:
        return "黄帝内经"
    # 诗经 (#580-599)
    if 580 <= seq <= 599:
        return "诗经"

    # --- 按关键词匹配 ---
    # 大学中庸
    dxzy_keywords = [
        "明明德", "修身", "格物", "致中和", "德者本", "富润屋",
        "博学之", "知止而后有定", "万物并育", "道并行而不相悖",
        "古之欲明明德于天下", "自天子以至于庶人", "正其心",
        "诚其意", "致其知", "齐其家", "治其国", "天下平",
        "大学之道", "在亲民", "止于至善", "德能致财",
        "君子先慎乎德", "有德此有人", "在上位不陵下",
        "爱与敬，其政之本", "不敬其身", "照端乎夫妇",
        "大德者必得其位", "德者本也，财者末也",
    ]
    for kw in dxzy_keywords:
        if kw in quote:
            return "大学中庸"

    # 黄帝内经
    hdnj_keywords = [
        "气缓", "气乱", "气和志达", "荣卫通利", "精气",
        "守形", "守神", "经脉", "形与神", "终其天年",
        "度百岁", "忧伤肺", "喜伤心", "思伤肺",
        "四肢者，诸阳之本", "粗守形，上守神",
        "阳受气于四末", "阴受气于五脏",
        "决死生", "处百病", "调虚实",
        "女子以血为本",
    ]
    for kw in hdnj_keywords:
        if kw in quote:
            return "黄帝内经"

    # 论语
    ly_keywords = [
        "智者不惑", "仁者不忧", "勇者不惧",
        "性相近", "习相远",
        "器者，各适其用", "不器",
        "论语集注", "论语注疏",
        "克己复性", "克己复礼",
    ]
    for kw in ly_keywords:
        if kw in quote:
            return "论语"

    # 孟子
    mz_keywords = [
        "不孝有三", "无后为大", "舜不告而娶",
        "天下之本在国", "国之本在家",
        "恻隐之心", "仁之端",
        "缘木求鱼",
    ]
    for kw in mz_keywords:
        if kw in quote:
            return "孟子"

    # 周易
    zy_keywords = [
        "同声相应", "同气相求",
        "感而遂通", "寂然不动",
        "孤阴不生", "独阳不长", "独阴不生", "独阳不生",
        "天一生水", "地六成之",
        "水曰润下", "火曰炎上", "木曰曲直",
        "易无思也", "无为也",
        "与物皆入吉凶",
    ]
    for kw in zy_keywords:
        if kw in quote:
            return "周易"

    # 庄子
    zz_keywords = [
        "君子役物", "小人役于物",
        "心斋", "虚而待物",
        "无用者", "不为世用",
        "夫无形者，物之大祖",
        "君子使物", "不为物使",
    ]
    for kw in zz_keywords:
        if kw in quote:
            return "庄子"

    # 诗经 (关键词补充，序号范围外的)
    sj_keywords = [
        "不稼不穑", "靡不有初", "鲜克有终", "鲜可有终",
        "父兮生我", "母兮鞠我", "欲报之德",
        "投我以木瓜", "报之以琼琚",
        "颜如舜华", "青青子衿", "悠悠我心",
        "手如柔荑", "肤如凝脂", "巧笑倩兮", "美目盼兮",
        "一日不见", "如三月兮",
        "我心匪石", "不可转也", "邶风·柏舟",
        "采葛", "卫风·木瓜",
    ]
    for kw in sj_keywords:
        if kw in quote:
            return "诗经"

    return None


def _is_folk_or_modern(seq: int, quote: str) -> bool:
    """
    判断引用是否为俗语/现代表述/作者原创/书名列举等，不需要校对。
    """
    # 纯书名列举
    if re.match(r'^[《》\s、和与]+$', re.sub(r'[\u4e00-\u9fff]+', '', quote)) and '《' in quote and len(quote) < 80:
        book_names = re.findall(r'《([^》]+)》', quote)
        if len(book_names) >= 2:
            return True

    # 明确的俗语/现代表述
    folk_patterns = [
        "源代码",
        "你希望别人怎样对待你",
        "万变不离其宗",
        "避讳刘恒", "不特显", "不特贱",
        "凡皆所求，皆被其所困",
        "万物皆被我所用",
        "天下熙熙，皆为利来",
        "与善人居", "入兰芝之室", "入芝兰之室",
        "心正者，家道和",
        "不争之争",
        "狗不嫌家贫", "儿不嫌母丑",
        "女子无才便是德",
        "德不配位，必有余殃",
        "命由天定，运由己造",
        "体弱者多情",
        "男性以肾为先天",
        "输在起跑线",
        "如河上公所言",
        "滴水之恩", "涌泉相报",
        "四体皆能动",
        "人误地一时",
        "四水归堂", "徽派建筑",
        "整体大于部分之和",
        "顺则凡，逆则圣",
        "顺为凡，逆为仙",
        "彩绘全注全译",
        "蔡志忠",
        "老子讲的是", "孔子是教我们",
        "无极生太极", "周敦颐", "太极图说",
        "无极而太极",
        "太极图的起源", "伏羲观测",
        "以静制动", "执古御今",
        "大勇若怯", "大智若愚",
        "色即是空",
        "仓廪实", "知礼节", "衣食足", "知荣辱",
        "心若止水", "万事皆安",
        "公独何人", "心如止水",
        "孟母三迁", "列女传",
        "淮南子集释", "何宁",
        "人生为己，天经地义",
        "观天之道，执天之行",
        "男子有德便是才",
        "含，藏也", "章，美也",
        "伦常乖舛", "德不配位",
        "究天人之际", "通古今之变",
        "婚礼中的",
        "以义断", "示之以公",
        "山海经", "精卫", "夸父追日",
        "有鸟焉", "文首", "白喙",
        "有木名曰建木",
        "九丘",
        "无味之味", "陆次云",
        "甘香如兰",
        "王弼注", "以恬淡为味",
        "凡耕之本", "趣时",
        "河图", "洛书", "导航",
        "忠恕者，仁之用也",
        "十三经注疏",
        "四书章句集注",
        "止者，必至于是",
        "此只是有所择之人",
        "忠者，尽己之谓",
        "王阳明解",
        "王弼注：",
        "朱熹解释",
        "朱熹注：",
        "夫天地运而相通",
        "夫精神志意者",
        "夫形者神之舍也",
        "故圣人制礼乐",
        "哲学的用途乃无用之大用",
    ]

    for p in folk_patterns:
        if p in quote:
            return True

    # 书目引用 (出版社、版本信息)
    if re.search(r'出版社|版$|全\d+册', quote):
        return True

    # 《诗经》提到但不是具体引用
    if "你多读读" in quote or "你只要学到" in quote:
        return True

    # 以破折号+书名号开头的出处标注（如 "——《诗经·王风·采葛》"）
    if quote.startswith("\u2014"):
        return True

    return False


def read_csv() -> tuple[list[str], list[dict]]:
    """读取 CSV，返回 (fieldnames, rows)"""
    with open(CSV_INPUT, encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames
        rows = list(reader)
    return fieldnames, rows


def write_csv(path: Path, fieldnames: list[str], rows: list[dict]):
    """写出 CSV"""
    with open(path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    print(f"已写入: {path} ({len(rows)} 行)")


# ============================================================
# 任务 2: 标记俗语/现代表述
# ============================================================

def cmd_mark():
    """标记无需校对的行"""
    fieldnames, rows = read_csv()

    # 先找出能匹配到 bib 的序号
    bib_seqs = set()
    folk_seqs = set()

    for row in rows:
        if row.get("校对结果") != "原文未上传":
            continue
        seq = int(row["序号"])
        quote = row["引用文字"]

        book = _match_quote_to_book(seq, quote)
        if book:
            bib_seqs.add(seq)
        elif _is_folk_or_modern(seq, quote):
            folk_seqs.add(seq)

    print(f"可匹配 bib: {len(bib_seqs)} 条")
    print(f"俗语/现代: {len(folk_seqs)} 条")
    print(f"仍无法处理: {169 - len(bib_seqs) - len(folk_seqs)} 条")

    # 输出未分类的
    remaining = []
    for row in rows:
        if row.get("校对结果") != "原文未上传":
            continue
        seq = int(row["序号"])
        if seq not in bib_seqs and seq not in folk_seqs:
            remaining.append(f"  #{seq}: {row['引用文字'][:60]}")
    if remaining:
        print(f"\n未分类的行:")
        for r in remaining:
            print(r)

    # 标记 folk 行
    marked_count = 0
    for row in rows:
        if row.get("校对结果") != "原文未上传":
            continue
        seq = int(row["序号"])
        if seq in folk_seqs:
            row["校对结果"] = "无需校对"
            row["问题描述"] = ""
            row["综合评价"] = "非经典引用（俗语/现代表述/作者原创），无需核对原文"
            marked_count += 1

    write_csv(CSV_MARKED, fieldnames, rows)
    print(f"已标记 {marked_count} 条为无需校对")


# bib 文件有效性最低字符数（低于此值认为文件无正文）
MIN_BIB_CHARS = 5000


# ============================================================
# 任务 1: 重校有 bib 的引用
# ============================================================

def _load_previous_recheck() -> dict[str, dict]:
    """加载之前已完成的重校结果（用于断点续校）。
    '校对失败' 的不算完成，会被重试。
    """
    if not CSV_RECHECK.exists():
        return {}
    result = {}
    with open(CSV_RECHECK, encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            verdict = row.get("校对结果", "")
            # 跳过未处理和失败的，让它们被重试
            if verdict in ("原文未上传", "", "校对失败"):
                continue
            result[row["序号"]] = row
    return result


async def cmd_recheck():
    """重校有 bib 的引用（支持断点续校）"""
    # 确保在项目目录下，以便导入 app 模块
    sys.path.insert(0, str(ROOT))
    from app.services.proofreader import verify_quote

    fieldnames, rows = read_csv()

    # 加载之前的进度
    prev = _load_previous_recheck()
    if prev:
        print(f"发现之前的进度: {len(prev)} 条已完成，将跳过")

    # 预加载所有需要的 bib 文件
    bib_cache: dict[str, str] = {}
    invalid_bibs: set[str] = set()

    # 找出需要重校的行
    recheck_items: list[tuple[int, dict, str]] = []  # (row_index, row, book_key)
    for i, row in enumerate(rows):
        if row.get("校对结果") != "原文未上传":
            continue
        seq = int(row["序号"])
        quote = row["引用文字"]
        book = _match_quote_to_book(seq, quote)
        if book:
            recheck_items.append((i, row, book))
            if book not in bib_cache and book not in invalid_bibs:
                text = _read_bib(book)
                if text and len(text) >= MIN_BIB_CHARS:
                    bib_cache[book] = text
                    print(f"已加载 bib: {book} ({len(text)} 字符)")
                elif text:
                    invalid_bibs.add(book)
                    print(f"⚠ bib 无正文: {book} (仅 {len(text)} 字符，为元数据)")
                else:
                    invalid_bibs.add(book)
                    print(f"⚠ 无法加载 bib: {book}")

    print(f"\n需要重校: {len(recheck_items)} 条")
    print(f"有效 bib: {list(bib_cache.keys())}")
    if invalid_bibs:
        print(f"无效 bib: {list(invalid_bibs)}")

    # 逐条校对
    success = 0
    failed = 0
    skipped_prev = 0
    skipped_invalid = 0

    for idx, (row_i, row, book) in enumerate(recheck_items):
        seq = int(row["序号"])
        seq_str = str(seq)
        quote = row["引用文字"]

        # 断点续校: 如果之前已校对，复用结果
        if seq_str in prev:
            old = prev[seq_str]
            row["校对结果"] = old["校对结果"]
            row["问题描述"] = old["问题描述"]
            row["综合评价"] = old["综合评价"]
            skipped_prev += 1
            continue

        # bib 无效: 标记为原文缺失
        if book in invalid_bibs:
            row["校对结果"] = "原文缺失"
            row["问题描述"] = f"bib文件（{book}）无正文内容"
            row["综合评价"] = f"参考书（{book}）的电子版仅含元数据，无法校对。需替换为有正文的版本。"
            skipped_invalid += 1
            continue

        source_text = bib_cache.get(book, "")
        if not source_text:
            row["校对结果"] = "原文缺失"
            row["问题描述"] = f"bib文件（{book}）未找到"
            row["综合评价"] = f"bib 目录中未找到{book}的文件"
            failed += 1
            continue

        print(f"  [{idx+1}/{len(recheck_items)}] #{seq}: {quote[:40]}... → {book}")

        quote_info = {
            "quote": quote,
            "context_before": "",
            "context_after": "",
            "author_explanation": "",
            "location_hint": "",
        }

        try:
            result = await verify_quote(quote_info, source_text)

            # 提取结果
            verdict = result.get("verdict", "")
            summary = result.get("summary", "")
            has_issue = result.get("has_issue")

            # 构建问题描述
            issues_parts = []
            if result.get("text_issues"):
                issues_parts.append(f"文字: {result['text_issues']}")
            if result.get("explanation_issues"):
                issues_parts.append(f"解释: {result['explanation_issues']}")
            if result.get("context_issues"):
                issues_parts.append(f"语境: {result['context_issues']}")
            problem_desc = "; ".join(issues_parts) if issues_parts else ""

            # 映射 verdict 到 CSV 校对结果
            if has_issue is True:
                csv_verdict = "有问题"
            elif has_issue is False:
                csv_verdict = "通过"
            elif result.get("error"):
                csv_verdict = "校对失败"
                problem_desc = result.get("error", "")
            else:
                csv_verdict = verdict if verdict else "通过"

            row["校对结果"] = csv_verdict
            row["问题描述"] = problem_desc
            row["综合评价"] = summary
            success += 1
            print(f"    → {csv_verdict}: {summary[:60]}")

        except Exception as e:
            print(f"    → 校对失败: {e}")
            row["校对结果"] = "校对失败"
            row["问题描述"] = str(e)
            row["综合评价"] = f"重校过程出错: {e}"
            failed += 1

        # 每 5 条保存一次进度
        if (idx + 1) % 5 == 0:
            write_csv(CSV_RECHECK, fieldnames, rows)
            print(f"  (已保存进度)")

    write_csv(CSV_RECHECK, fieldnames, rows)
    print(f"\n重校完成: API成功 {success}, API失败 {failed}, "
          f"续校跳过 {skipped_prev}, 原文缺失 {skipped_invalid}")


# ============================================================
# 合并
# ============================================================

def cmd_merge():
    """合并重校和标记结果为最终版"""
    # 读取原始 CSV
    fieldnames, original_rows = read_csv()

    # 读取重校结果
    recheck_map = {}
    if CSV_RECHECK.exists():
        with open(CSV_RECHECK, encoding="utf-8-sig", newline="") as f:
            for row in csv.DictReader(f):
                if row.get("校对结果") not in ("原文未上传",):
                    recheck_map[row["序号"]] = row
        print(f"重校结果: {len(recheck_map)} 条已更新")

    # 读取标记结果
    marked_map = {}
    if CSV_MARKED.exists():
        with open(CSV_MARKED, encoding="utf-8-sig", newline="") as f:
            for row in csv.DictReader(f):
                if row.get("校对结果") == "无需校对":
                    marked_map[row["序号"]] = row
        print(f"标记结果: {len(marked_map)} 条")

    # 合并: 重校优先，其次标记，最后保留原始
    final_rows = []
    updated = 0
    for row in original_rows:
        seq = row["序号"]
        if seq in recheck_map:
            final_rows.append(recheck_map[seq])
            updated += 1
        elif seq in marked_map:
            final_rows.append(marked_map[seq])
            updated += 1
        else:
            final_rows.append(row)

    # 统计最终状态
    still_unuploaded = sum(1 for r in final_rows if r.get("校对结果") == "原文未上传")

    write_csv(CSV_FINAL, fieldnames, final_rows)
    print(f"\n已合并 {updated} 条更新")
    print(f"最终'原文未上传'数量: {still_unuploaded} (原始 169)")


# ============================================================
# 补校：直接更新修复版 CSV 中的"原文缺失"/"校对失败"行
# ============================================================

async def cmd_patch():
    """补校修复版 CSV 中的原文缺失/校对失败行"""
    sys.path.insert(0, str(ROOT))
    from app.services.proofreader import verify_quote

    # 直接读取修复版
    with open(CSV_FINAL, encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames
        rows = list(reader)

    # 预加载 bib
    bib_cache: dict[str, str] = {}

    # 找出需要补校的行
    patch_items = []
    for i, row in enumerate(rows):
        verdict = row.get("校对结果", "")
        if verdict not in ("原文缺失", "校对失败"):
            continue
        seq = int(row["序号"])
        quote = row["引用文字"]
        book = _match_quote_to_book(seq, quote)
        if book:
            patch_items.append((i, row, book))
            if book not in bib_cache:
                text = _read_bib(book)
                if text and len(text) >= MIN_BIB_CHARS:
                    bib_cache[book] = text
                    print(f"已加载 bib: {book} ({len(text)} 字符)")
                else:
                    print(f"⚠ bib 仍无效: {book} ({len(text) if text else 0} 字符)")

    print(f"\n需要补校: {len(patch_items)} 条")

    success = 0
    failed = 0
    for idx, (row_i, row, book) in enumerate(patch_items):
        seq = int(row["序号"])
        quote = row["引用文字"]
        source_text = bib_cache.get(book, "")

        if not source_text:
            print(f"  [{idx+1}/{len(patch_items)}] #{seq} 跳过 (bib 仍无效)")
            failed += 1
            continue

        print(f"  [{idx+1}/{len(patch_items)}] #{seq}: {quote[:40]}... → {book}")

        quote_info = {
            "quote": quote,
            "context_before": "",
            "context_after": "",
            "author_explanation": "",
            "location_hint": "",
        }

        try:
            result = await verify_quote(quote_info, source_text)
            verdict = result.get("verdict", "")
            summary = result.get("summary", "")
            has_issue = result.get("has_issue")

            issues_parts = []
            if result.get("text_issues"):
                issues_parts.append(f"文字: {result['text_issues']}")
            if result.get("explanation_issues"):
                issues_parts.append(f"解释: {result['explanation_issues']}")
            if result.get("context_issues"):
                issues_parts.append(f"语境: {result['context_issues']}")
            problem_desc = "; ".join(issues_parts) if issues_parts else ""

            if has_issue is True:
                csv_verdict = "有问题"
            elif has_issue is False:
                csv_verdict = "通过"
            elif result.get("error"):
                csv_verdict = "校对失败"
                problem_desc = result.get("error", "")
            else:
                csv_verdict = verdict if verdict else "通过"

            row["校对结果"] = csv_verdict
            row["问题描述"] = problem_desc
            row["综合评价"] = summary
            success += 1
            print(f"    → {csv_verdict}: {summary[:60]}")

        except Exception as e:
            print(f"    → 校对失败: {e}")
            row["校对结果"] = "校对失败"
            row["问题描述"] = str(e)
            row["综合评价"] = f"补校过程出错: {e}"
            failed += 1

        # 每 5 条保存一次
        if (idx + 1) % 5 == 0:
            write_csv(CSV_FINAL, fieldnames, rows)
            print(f"  (已保存进度)")

    write_csv(CSV_FINAL, fieldnames, rows)

    # 统计
    stats = {}
    for r in rows:
        v = r.get("校对结果", "")
        stats[v] = stats.get(v, 0) + 1
    print(f"\n补校完成: 成功 {success}, 失败 {failed}")
    print(f"最终状态: {dict(sorted(stats.items(), key=lambda x: -x[1]))}")


# ============================================================
# 入口
# ============================================================

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    cmd = sys.argv[1]
    if cmd == "mark":
        cmd_mark()
    elif cmd == "recheck":
        asyncio.run(cmd_recheck())
    elif cmd == "merge":
        cmd_merge()
    elif cmd == "patch":
        asyncio.run(cmd_patch())
    else:
        print(f"未知命令: {cmd}")
        print(__doc__)
        sys.exit(1)
