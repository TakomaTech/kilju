Kilju is a dynamic and strong programming language.

```
format "Hello, World"
```

```
~(mut) hellostring = "Hello, " ~
~(mut) worldstring = "World!" ~

format hellostring, worldstring
```

```
import "localtime"

~(mut) date = null

localtime > getComputerDate()
	into (date)
format date
```

```
fnc HelloWorldLoop() start
	loop
		format "Hello! This will never end"
	end loop
end fnc

helloworldloop()
```

```
if 5 * 10 == 50
	format "Wrong"
else
	format "Correct"
```
```
~(mut) count = 0

while count < 5
	format count
	count + 1 into count
```

## VS Code Extension

This repository includes a Kilju VS Code extension with syntax highlighting and `.kj` support.

Usage:

1. Open a `.kj` file in VS Code.
2. Pick `Kilju` from the language mode selector.
3. The editor highlights keywords, strings, numbers, operators, comments, and punctuation.
