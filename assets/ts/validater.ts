interface HTMLElementEvent<T extends HTMLElement> extends Event {
  target: T;
}

/**
 * 検証ルール
 * @param message 検証失敗時のメッセージ
 * @param logic 検証ロジック、成功時にtrue
 */
interface Rule {
  message: string;
  logic: (value: string | number) => boolean;
}

/**
 * 検証情報
 * @param name 検証対象fieldのname属性
 * @param customAction 指定name属性用の検証失敗時のカスタム処理
 * @param customMessages 各ルール毎のカスタムメッセージ
 * @param rules 指定name属性に適用する検証ルール
 * @param result 指定name属性に対する検証結果
 */
interface Validate {
  name: string;
  customAction?: (messages?: string[]) => void;
  customMessages?: {[key: string]: string};
  rules: string[];
  result?: Result;
}

/**
 * 検証結果
 * @param isValid 検証成功か否か
 * @param messages 検証失敗時のアラートメッセージ群
 */
interface Result {
  isValid: boolean;
  messages: string[]; 
}

/**
 * 検証クラス、Formの各fieldの検証及び、submitアクションの管理を行う
 */
class Validater {

  /** @param targetFormId 検証対象となるFormのID */
  private targetFormId: string; // TODO: ID以外の指定を出来るようにする
  /** @param submitId submitアクションを持つfieldのID */
  private submitId: string; // TODO: default値つけたい
  /** @param defaultAction 検証失敗時の共通処理 */
  private defaultAction: (messages?: string[]) => void;
  /** @param rules 指定可能な検証ルールセット、検証名で管理し指定可能 */
  private rules: { [key: string]: Rule } = {};
  /** @param validates 対象Form内の対象の検証情報 */
  private validates: Validate[];
  /** @param shouldDisabledSubmit submitアクションを持つDOMをDisabled状態にするか */
  private shouldDisabledSubmit: boolean = true;
  /** @param customSubmitAction submitアクションをカスタム出来る */
  private customSubmitAction: () => {};

  /**
   * @param targetFormId 検証対象となるFormのID
   * @param submitId submitアクションを持つfieldのID
   */
  constructor(targetFormId: string, submitId: string) {
    this.targetFormId = targetFormId;
    this.submitId = submitId;
    const {
      required,
      email
    } = this.defaultRules;
    this.rules = {
      required,
      email
    };
  }

  /**
   * 検証クラスの初期化処理
   * @param validates 検証対象の設定
   * @param options オプション設定
   */
  init(
    validates: Validate[] = [],
    {
      additonalRules = {},
      defaultAction = () => null,
      shouldDisabledSubmit = false
    }: {
      additonalRules?: { [key: string]: Rule };
      defaultAction?: (messages?: string[]) => void;
      shouldDisabledSubmit?: boolean;
    } = {}
  ): void {
    this.addRules(additonalRules);
    this.setDefaultAction(defaultAction);
    this.setValidates(validates);
    this.shouldDisabledSubmit = shouldDisabledSubmit;
    this.doValidateAll(true);
    this.addValidateOnBlur();
    this.overrideSubmitAction();
    this.validateToggleDisabledSubmit();
  }

  /**
   * 検証ルールの追加
   * @param rules: 追加したいルールセット群
   */
  addRules(rules: { [key: string]: Rule } = {}): void {
    Object.assign(this.rules, rules);
  }

  /**
   * デフォルト処理の設定
   * @param action 追加したいデフォルト処理
   */
  setDefaultAction(action: (messages?: string[]) => void) {
    this.defaultAction = action;
  };

  /**
   * submitボタンをdisabled状態にするか
   */
  isDisabled() {
    return this.validates.reduce( ( isDisabled: boolean, validate: Validate ): boolean => {
      return isDisabled || !validate.result.isValid;
    }, false);
  }

  /**
   * 検証情報の設定、設定時に
   * @param validates 
   */
  setValidates(validates: Validate[]) {
    this.validates = validates.map( (validate: Validate): Validate => {
      return {
        name: validate.name,
        rules: validate.rules,
        customAction: validate.customAction || this.defaultAction,
        customMessages: validate.customMessages || {},
        result: validate.result || { isValid: true, messages: []}
      }
    });
  }

  /**
   * blur時に検証を行う
   */
  addValidateOnBlur() {
    this.validates.forEach( (validate: Validate, index:number, validates: Validate[]) => {
      const field =  document.getElementsByName(validate.name);
      if(field.length) field[0].addEventListener('blur', (e: HTMLElementEvent<HTMLInputElement>) => {
        validates[index].result = this.doValidate(validate, e.target.value);
        this.validateToggleDisabledSubmit();
        this.doAction(validate);
      })
    })
  };

  /**
   * 検証結果が失敗だった場合に設定された処理を行う。
   * カスタムアクションが設定されていた場合は、カスタムアクションを
   * 設定されていない場合はデフォルトアクションを行う。
   * @param validate 対象の検証情報
   */
  doAction(validate: Validate) {
    if(!validate.result.isValid){
      validate.customAction(validate.result.messages);
    }
  }

  /**
   * 全ての検証を実行
   * @param withoutAction 検証後の処理を行うかどうか
   */
  doValidateAll(withoutAction: boolean = false) {
    this.validates.forEach( (validate: Validate, index: number,validates: Validate[]): void => {
      const field = document.getElementsByName(validate.name);
      if(field.length) {
        const firstField = <HTMLInputElement> field[0];
        validates[index].result = this.doValidate(validate, firstField.value);
        if(!withoutAction) this.doAction(validate);
      } else {
        validates[index].result = {isValid: true, messages: []};
      }
    });
  }

  /**
   * 検証の実行
   * @param validate 検証情報
   * @param value 検証対象の値
   * @returns 検証結果
   */
  doValidate(validate: Validate,value: string): Result {
    const messages: string[] = []; 
    const isValid:boolean = validate.rules.reduce(
      (acc: boolean, ruleName: string): boolean => {
        const rule = this.getRule(ruleName);
        if(!rule.logic(value)) messages.push(validate.customMessages[ruleName] || rule.message);
        return acc && rule.logic(value);
      }, true);
    return {
      isValid,
      messages
    }
  }

  /**
   * ルールの取得
   * @param ruleName ルール名
   */
  getRule(ruleName: string): Rule {
    return this.rules[ruleName] || { message: '', logic: () => true };
  }

  /**
   * submitアクションの上書き
   */
  overrideSubmitAction() {
    const form = <HTMLInputElement> document.getElementById(this.targetFormId);
    form.addEventListener('submit', ( e: HTMLElementEvent<HTMLInputElement> ) => {
      e.preventDefault();
      this.doValidateAll();
      if(this.isDisabled()) {
        console.log('cant submit');
      } else {
        console.log('submit');
      }
    });  
  }

  /**
   * submitボタンのdisabled状態を更新
   */
  validateToggleDisabledSubmit(): void {
    if(this.shouldDisabledSubmit) {
      const submitDom =  <HTMLInputElement> document.getElementById(this.submitId);
      submitDom.disabled = this.isDisabled();
    }
  }


  /**
   * defaultのルール
   */
  private defaultRules = {
    required: {
      message: '必須入力項目です',
      logic: (input: string | number) => {
        return input !== '';
      }
    },
    email: {
      message: 'メールアドレスの形式で入力してください',
      logic: (input: string) => {
        return /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/.test(input);
      }
    }
  }
}