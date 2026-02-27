/**
 * @fileoverview Curated ChocoPy / Typed Python example programs.
 *
 * Each example is a self-contained program that compiles and (where applicable)
 * runs successfully in the compiler UI. The set is ordered from simple to complex,
 * progressively introducing language features so that new users can work through
 * them as an informal tutorial. The final example intentionally contains type
 * errors to demonstrate the compiler's error reporting.
 *
 * These examples are displayed in the "Examples" dropdown of the editor toolbar.
 * Adding a new entry here is all that is needed to surface it in the UI.
 */

/**
 * A single example program for the compiler UI's example picker.
 */
export interface Example {
  /** Short display name shown in the dropdown menu (e.g. "Hello World"). */
  name: string;
  /** One-line description of what the example demonstrates. */
  description: string;
  /** The complete ChocoPy source code, ready to be pasted into the editor. */
  code: string;
}

/**
 * The full catalog of example programs, ordered from introductory to advanced.
 *
 * Each entry targets a specific language feature or concept. The order mirrors
 * a typical teaching progression: output, variables, control flow, functions,
 * data types, OOP, and finally error handling.
 */
export const examples: Example[] = [
  // Demonstrates print() with different literal types: string, int, bool
  {
    name: 'Hello World',
    description: 'Basic output',
    code: `print("Hello, Typed Python!")
print(42)
print(True)
print(False)
`
  },
  // Demonstrates typed variable declarations, arithmetic operators, and comparison expressions
  {
    name: 'Variables & Expressions',
    description: 'Arithmetic and comparisons',
    code: `x: int = 10
y: int = 3

print(x + y)
print(x - y)
print(x * y)
print(x // y)
print(x % y)
print(x > y)
print(x == y)
print(x != y)
`
  },
  // Demonstrates while loops, if/elif/else branching, and accumulator pattern
  {
    name: 'Control Flow',
    description: 'If/elif/else and while',
    code: `n: int = 10
i: int = 1
total: int = 0

while i <= n:
    total = total + i
    i = i + 1

print(total)

if total > 50:
    print("Greater than 50")
elif total == 55:
    print("Exactly 55!")
else:
    print("50 or less")
`
  },
  // Demonstrates function definitions with type annotations, return types, and recursion
  {
    name: 'Functions',
    description: 'Function definitions and calls',
    code: `def factorial(n: int) -> int:
    if n <= 1:
        return 1
    else:
        return n * factorial(n - 1)

def fibonacci(n: int) -> int:
    if n <= 1:
        return n
    else:
        return fibonacci(n - 1) + fibonacci(n - 2)

print(factorial(10))
print(fibonacci(10))
`
  },
  // Demonstrates string concatenation, len(), indexing, and for-loop iteration over characters
  {
    name: 'Strings',
    description: 'String operations',
    code: `greeting: str = "Hello"
name: str = "World"
c: str = ""

print(greeting + ", " + name + "!")
print(len(greeting))
print(greeting[0])
print(greeting[4])

for c in greeting:
    print(c)
`
  },
  // Demonstrates list literals, indexing, len(), list concatenation, and for-loop iteration
  {
    name: 'Lists',
    description: 'List creation and indexing',
    code: `numbers: [int] = None
i: int = 0

numbers = [10, 20, 30, 40, 50]
print(numbers[0])
print(numbers[4])
print(len(numbers))

numbers = numbers + [60, 70]
print(len(numbers))

for i in numbers:
    print(i)
`
  },
  // Demonstrates class definitions, inheritance, __init__, method dispatch, and self parameter
  {
    name: 'Classes',
    description: 'Object-oriented programming',
    code: `class Animal(object):
    name: str = ""
    sound: str = ""

    def __init__(self: "Animal"):
        pass

    def speak(self: "Animal") -> str:
        return self.name + " says " + self.sound

class Dog(Animal):
    def __init__(self: "Dog"):
        self.name = "Dog"
        self.sound = "Woof"

class Cat(Animal):
    def __init__(self: "Cat"):
        self.name = "Cat"
        self.sound = "Meow"

dog: Dog = None
cat: Cat = None
dog = Dog()
cat = Cat()
print(dog.speak())
print(cat.speak())
`
  },
  // Demonstrates nested function definitions, closures, and the nonlocal keyword
  {
    name: 'Nested Functions',
    description: 'Closures and nonlocal',
    code: `def count_up(n: int) -> int:
    count: int = 0

    def add_one():
        nonlocal count
        count = count + 1

    i: int = 0
    while i < n:
        add_one()
        i = i + 1

    return count

print(count_up(5))
print(count_up(10))
`
  },
  // Demonstrates recursive data structures with forward-referenced class types and None checks
  {
    name: 'Linked List',
    description: 'Recursive data structures',
    code: `class Node(object):
    value: int = 0
    next: "Node" = None

def make_node(val: int) -> Node:
    n: Node = None
    n = Node()
    n.value = val
    return n

def print_list(head: Node):
    current: Node = None
    current = head
    while not (current is None):
        print(current.value)
        current = current.next

head: Node = None
n2: Node = None
n3: Node = None

head = make_node(1)
n2 = make_node(2)
n3 = make_node(3)
head.next = n2
n2.next = n3

print_list(head)
`
  },
  // Demonstrates a classic algorithm using list parameters, integer division, and early return
  {
    name: 'Binary Search',
    description: 'Search algorithm',
    code: `def binary_search(items: [int], target: int) -> int:
    lo: int = 0
    hi: int = 0
    mid: int = 0
    hi = len(items) - 1

    while lo <= hi:
        mid = (lo + hi) // 2
        if items[mid] == target:
            return mid
        elif items[mid] < target:
            lo = mid + 1
        else:
            hi = mid - 1

    return -1

data: [int] = None
data = [2, 5, 8, 12, 16, 23, 38, 42, 56, 72, 91]

print(binary_search(data, 23))
print(binary_search(data, 42))
print(binary_search(data, 99))
`
  },
  // Intentionally broken: demonstrates type mismatch errors and argument type errors
  {
    name: 'Type Errors',
    description: 'Intentional type errors',
    code: `def add(a: int, b: int) -> int:
    return a + b

x: int = 1
y: str = "hello"

# This will produce a type error
x = y

# Calling with wrong argument types
add("hello", "world")
`
  },
  // Demonstrates for-loop over strings, list concatenation expressions, and iteration
  {
    name: 'For Loops',
    description: 'Iteration patterns',
    code: `a: str = ""
c: int = 0
i: int = 0
nums: [int] = None

for a in "abcde":
    print(a)

for c in [1, 2, 3] + [11, 22, 33]:
    print(c)

nums = [10, 20, 30, 40, 50]
for i in nums:
    print(i * 2)
`
  }
];
