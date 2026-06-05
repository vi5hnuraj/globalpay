import { card } from "../assets";
import styles, { layout } from "../style";
import Button from "./Button";

const CardDeal = () => (
  <section className={layout.section}>
    <div className={layout.sectionInfo}>
      <h2 className={styles.heading2}>
        Transact globally, <br className="sm:block hidden" /> with zero friction.
      </h2>
      <p className={`${styles.paragraph} max-w-[470px] mt-5`}>
        Set up your profile, link your local bank account, and connect your MetaMask wallet. Our secure system handles the background conversions immediately, letting you focus on simple global fiat-to-crypto bridging in just a few clicks.
      </p>

      <Button styles={`mt-10`} />
    </div>

    <div className={layout.sectionImg}>
      <img src={card} alt="billing" className="w-[100%] h-[100%]" />
    </div>
  </section>
);

export default CardDeal;
