use bdk_wallet::bitcoin::psbt::Psbt;
use bdk_wallet::bitcoin::transaction::{Transaction, Version};
use bdk_wallet::bitcoin::absolute::LockTime;
fn main() {
  let psbt = Psbt::from_unsigned_tx(Transaction { version: Version::TWO, lock_time: LockTime::ZERO, input: vec![], output: vec![] }).unwrap();
  println!("{}", psbt.to_string());
}
