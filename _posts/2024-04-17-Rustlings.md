---
title: '清华大学操作系统训练营一阶段 Rustlings'
date: 2024/04/17
permalink: /posts/2024/03/Rustlings
excerpt: '清华大学操作系统训练营一阶段--Rustlings的一点记录'
tags:
  - Rust
  - OS
---

variable6.rs
```rust
fn main() {
    let number = "T-H-R-E-E"; // don't change this line
    println!("Spell a Number : {}", number);
    number = 3; // don't rename this variable
    println!("Number plus two is : {}", number + 2);
}
```
这里涉及到**影子变量**(shadow),这在c语言中是不允许的。 
修改如下，只需对number进行重新定义。  
```rust
fn main() {
    let number = "T-H-R-E-E"; // don't change this line
    println!("Spell a Number : {}", number);
    let number = 3; // don't rename this variable
    println!("Number plus two is : {}", number + 2);
}
```
if3.rs
if和else的返回值应该是相同的类型
```rust
pub fn animal_habitat(animal: &str) -> &'static str {
    let identifier = if animal == "crab" {
        1
    } else if animal == "gopher" {
        2.0
    } else if animal == "snake" {
        3
    } else {
        "Unknown"
    };

    // DO NOT CHANGE THIS STATEMENT BELOW
    let habitat = if identifier == 1 {
        "Beach"
    } else if identifier == 2 {
        "Burrow"
    } else if identifier == 3 {
        "Desert"
    } else {
        "Unknown"
    };

    habitat
}
```
修改如下：  
```rust
pub fn animal_habitat(animal: &str) -> &'static str {
    let identifier = if animal == "crab" {
        1
    } else if animal == "gopher" {
        2
    } else if animal == "snake" {
        3
    } else {
        4
    };

    // DO NOT CHANGE THIS STATEMENT BELOW
    let habitat = if identifier == 1 {
        "Beach"
    } else if identifier == 2 {
        "Burrow"
    } else if identifier == 3 {
        "Desert"
    } else {
        "Unknown"
    };

    habitat
}
```
primitive_types5.rs  
Destructure the `cat` tuple so that the println will work.  

```rust
fn main() {
    let cat = ("Furry McFurson", 3.5);
    //let /* your pattern here */ = cat;
    let (name,age) = cat;

    println!("{} is {} years old.", name, age);
}
```

primitive_types6.rs  
访问元组  
```rust
fn indexing_tuple() {
    let numbers = (1, 2, 3);
    // Replace below ??? with the tuple indexing syntax.
    let second = numbers.1;

    assert_eq!(2, second,
        "This is not the 2nd number in the tuple!")
}
```

vec1.rs

新建向量vec
```rust
fn array_and_vec() -> ([i32; 4], Vec<i32>) {
    let a = [10, 20, 30, 40]; // a plain array
    let v = vec![10,20,30,40]; // TODO: declare your vector here with the macro for vectors

    (a, v)
}
``` 

vec2.rs

两种方式对vec进行修改
```rust
fn vec_loop(mut v: Vec<i32>) -> Vec<i32> {
    for element in v.iter_mut() {
        // TODO: Fill this up so that each element in the Vec `v` is
        // multiplied by 2.
        *element*=2;
    }

    // At this point, `v` should be equal to [4, 8, 12, 16, 20].
    v
}

fn vec_map(v: &Vec<i32>) -> Vec<i32> {
    v.iter().map(|element| {
        // TODO: Do the same thing as above - but instead of mutating the
        // Vec, you can just return the new number!
        element*2
    }).collect()
}
```

move_semantics2.rs

涉及到变量的问题(?) ，和下面一条对应着来看  

```rust
fn main() {
    let vec0 = Vec::new();

    let mut vec1 = fill_vec(vec0.clone());

    println!("{} has length {}, with contents: `{:?}`", "vec0", vec0.len(), vec0);

    vec1.push(88);

    println!("{} has length {}, with contents `{:?}`", "vec1", vec1.len(), vec1);
}

fn fill_vec(vec: Vec<i32>) -> Vec<i32> {
    let mut vec = vec;

    vec.push(22);
    vec.push(44);
    vec.push(66);

    vec
}
```


move_semantics3.rs

```rust
fn main() {
    let vec0 = Vec::new();

    let mut vec1 = fill_vec(vec0);

    println!("{} has length {} content `{:?}`", "vec1", vec1.len(), vec1);

    vec1.push(88);

    println!("{} has length {} content `{:?}`", "vec1", vec1.len(), vec1);
}

fn fill_vec(mut vec: Vec<i32>) -> Vec<i32> {
    vec.push(22);
    vec.push(44);
    vec.push(66);

    vec
}
```
move_semantics5.rs

同一时间一个变量只能有一个可变引用

```rust
fn main() {
    let mut x = 100;
    let y = &mut x;
    let z = &mut x;
    *y += 100;
    *z += 1000;
    assert_eq!(x, 1200);
}
//改为：
fn main() {
    let mut x = 100;
    let y = &mut x;
    *y += 100;
    let z = &mut x;
    *z += 1000;
    assert_eq!(x, 1200);
}
```

move_semantics6.rs

所有权

```rust
fn main() {
    let data = "Rust is great!".to_string();

    get_char(&data);

    string_uppercase(data);
}

// Should not take ownership
fn get_char(data: &String) -> char {
    data.chars().last().unwrap()
}

// Should take ownership
fn string_uppercase(mut data: String) {
    data = data.to_uppercase();

    println!("{}", data);
}
```

struct2.rs

在原有的结构体的基础上进行新建结构体，只修改部分变量，其余的和原有模版保持不变  
```rust
fn your_order() {
        let order_template = create_order_template();
        // TODO: Create your own order using the update syntax and template above!
        let your_order = Order{ 
            name: String::from("Hacker in Rust"),
            count: 1,
            ..order_template
        };
        assert_eq!(your_order.name, "Hacker in Rust");
        assert_eq!(your_order.year, order_template.year);
        assert_eq!(your_order.made_by_phone, order_template.made_by_phone);
        assert_eq!(your_order.made_by_mobile, order_template.made_by_mobile);
        assert_eq!(your_order.made_by_email, order_template.made_by_email);
        assert_eq!(your_order.item_number, order_template.item_number);
        assert_eq!(your_order.count, 1);
    }
```

hashmap2.rs

Hash maps have a special API for this called entry that takes the key you want to check as a parameter. The return value of the entry method is an enum called Entry that represents a value that might or might not exist. Let’s say we want to check whether the key for the Yellow team has a value associated with it. 

The or_insert method on Entry is defined to return a mutable reference to the value for the corresponding Entry key if that key exists, and if not, inserts the parameter as the new value for this key and returns a mutable reference to the new value. This technique is much cleaner than writing the logic ourselves and, in addition, plays more nicely with the borrow checker.

```rust
    for fruit in fruit_kinds {
        // TODO: Insert new fruits if they are not already present in the
        // basket. Note that you are not allowed to put any type of fruit that's
        // already present!
        basket.entry(fruit).or_insert(1);
    }
```

errors2.rs  

? 是 Rust 中的错误处理操作符。通常用于尝试解析或执行可能失败的操作，并在出现错误时提前返回错误，以避免程序崩溃或出现未处理的错误。

具体来说，? 用于处理 Result 或 Option 类型的返回值。
```rust
pub fn total_cost(item_quantity: &str) -> Result<i32, ParseIntError> {
    let processing_fee = 1;
    let cost_per_item = 5;
    let qty = item_quantity.parse::<i32>() ?; //加个问号就好

    Ok(qty * cost_per_item + processing_fee)
}
```

### Traits

A trait is a collection of methods.

Data types can implement traits. To do so, the methods making up the trait are defined for the data type. For example, the `String` data type implements the `From<&str>` trait. This allows a user to write `String::from("hello")`.

In this way, traits are somewhat similar to Java interfaces and C++ abstract classes.

Some additional common Rust traits include:

- `Clone` (the `clone` method)
- `Display` (which allows formatted display via `{}`)
- `Debug` (which allows formatted display via `{:?}`)

Because traits indicate shared behavior between data types, they are useful when writing generics.

### Further information

- [Traits](https://doc.rust-lang.org/book/ch10-02-traits.html)

traits4.rs:

创建关于共享行为(trait)的两个实例的泛型  
```rust
// YOU MAY ONLY CHANGE THE NEXT LINE
fn compare_license_types<T:Licensed,U:Licensed>(software: T, software_two: U) -> bool {
    software.licensing_info() == software_two.licensing_info()
}
```
traits5.rs:  
使用+来放行实现了多种共享行为的类型  
```rust
fn some_func<T:SomeTrait+OtherTrait>(item: T) -> bool {
    item.some_function() && item.other_function()
}
```