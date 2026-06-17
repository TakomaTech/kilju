from typing import Any, Dict, List, Optional


class Element:
    def __init__(self, tag: str, attributes: Optional[Dict[str, str]] = None, children: Optional[List[Any]] = None):
        self.tag = tag
        self.attributes = attributes or {}
        self.children = children or []

    def add_child(self, child: Any) -> None:
        self.children.append(child)

    def set_attribute(self, name: str, value: str) -> None:
        self.attributes[name] = value

    def to_string(self) -> str:
        attr_str = ""
        for key, value in self.attributes.items():
            attr_str += f' {key}="{value}"'
        
        if not self.children:
            return f"<{self.tag}{attr_str} />"
        
        children_str = "".join(child.to_string() if isinstance(child, Element) else str(child) for child in self.children)
        return f"<{self.tag}{attr_str}>{children_str}</{self.tag}>"


def createElement(tag: str, **attrs: Any) -> Element:
    return Element(tag, {k: str(v) for k, v in attrs.items()})


def createChild(parent: Element, tag: str, **attrs: Any) -> Element:
    child = Element(tag, {k: str(v) for k, v in attrs.items()})
    parent.add_child(child)
    return child


def createText(parent: Element, tag: str, text: str, **attrs: Any) -> Element:
    child = Element(tag, {k: str(v) for k, v in attrs.items()})
    child.add_child(text)
    parent.add_child(child)
    return child


def addText(element: Element, text: str) -> None:
    element.add_child(text)


def stringify(element: Element) -> str:
    return element.to_string()


def div(content: str = "", **attrs: Any) -> Element:
    el = Element("div", {k: str(v) for k, v in attrs.items()})
    if content:
        el.add_child(content)
    return el


def p(content: str = "", **attrs: Any) -> Element:
    el = Element("p", {k: str(v) for k, v in attrs.items()})
    if content:
        el.add_child(content)
    return el


def h1(content: str = "", **attrs: Any) -> Element:
    el = Element("h1", {k: str(v) for k, v in attrs.items()})
    if content:
        el.add_child(content)
    return el


def h2(content: str = "", **attrs: Any) -> Element:
    el = Element("h2", {k: str(v) for k, v in attrs.items()})
    if content:
        el.add_child(content)
    return el


def h3(content: str = "", **attrs: Any) -> Element:
    el = Element("h3", {k: str(v) for k, v in attrs.items()})
    if content:
        el.add_child(content)
    return el


def a(href: str, content: str = "", **attrs: Any) -> Element:
    el = Element("a", {**{"href": href}, **{k: str(v) for k, v in attrs.items()}})
    if content:
        el.add_child(content)
    return el


def ul(*items: Any, **attrs: Any) -> Element:
    el = Element("ul", {k: str(v) for k, v in attrs.items()})
    for item in items:
        li_el = Element("li")
        li_el.add_child(item)
        el.add_child(li_el)
    return el


def ol(*items: Any, **attrs: Any) -> Element:
    el = Element("ol", {k: str(v) for k, v in attrs.items()})
    for item in items:
        li_el = Element("li")
        li_el.add_child(item)
        el.add_child(li_el)
    return el


def table(*rows: Any, **attrs: Any) -> Element:
    el = Element("table", {k: str(v) for k, v in attrs.items()})
    for row in rows:
        el.add_child(row)
    return el


def tr(*cells: Any) -> Element:
    el = Element("tr")
    for cell in cells:
        td_el = Element("td")
        td_el.add_child(cell)
        el.add_child(td_el)
    return el
