import React, { Component } from 'react';
import cookie from 'react-cookie';
import logo from './logo.svg';
import update from 'react-addons-update';
import 'whatwg-fetch';
import './App.css';

const URL = 'http://127.0.0.1:8080';


class Authorize extends Component {
  state = {
    login: '',
    password: '',
    errorMessage: ''
  }

  errors = {
    400: 'Пустой логин или пароль',
    418: 'Неверный пароль'
  }

  onChangeLogin(e) {
    this.setState(update(this.state, {
      login: {$set: e.target.value}
    }))
  }

  onChangePassword(e) {
    this.setState(update(this.state, {
      password: {$set: e.target.value}
    }))
  }

  onClickAuthorize() {
    fetch(`${URL}/auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        login: this.state.login,
        password: this.state.password,
      })
    }).then(resp => {
      this.setState(update(this.state, {
        errorMessage: {$set: ''}
      }));
      if (resp.status === 200) {
        return resp.json();
      } else {
        let message;
        if (resp.status in this.errors) {
          message = this.errors[resp.status];
        } else {
          message = 'Неизвестная ошибка';
        }
        this.setState(update(this.state, {
          errorMessage: {$set: message}
        }))
      }
    }).then(res => {
      if (res) {
        this.props.onAuthorize(res.token);
      }
    })
  }

  render() {
    let error;
    if (this.state.errorMessage.length) {
      error = <p>{this.state.errorMessage}</p>;
    }
    return (
      <div>
        {error}

        <label>
          Логин:
          <input type="text"
                 value={this.state.login}
                 onChange={this.onChangeLogin.bind(this)} />
        </label>
        <br/>

        <label>
          Пароль:
          <input type="password"
                 id="password"
                 value={this.state.password}
                 onChange={this.onChangePassword.bind(this)} />
        </label>
        <br />

        <button onClick={this.onClickAuthorize.bind(this)}>Войти</button>
      </div>
    );
  }
}


class Chat extends Component {
  state = {
    activeChat: 0,
    chats: [],
    messages: [],
  }

  componentDidMount() {
    this.fetchChatList(chats => {
      this.setState(update(this.state, {
        chats: {$set: chats}
      }))
    })
  }

  fetchChatList(callback) {
    fetch(`${URL}/chat/list`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-Token': this.props.token
      }
    }).then(resp => {
      if (resp.status === 200) {
        return resp.json();
      } else {
        this.props.onExpire();
      }
    }).then(chats => {
      callback(chats);
    })
  }

  fetchChatHistory(chatId, callback) {
    fetch(`${URL}/chat/${chatId}/history`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-Token': this.props.token
      }
    }).then(resp => {
      this.setState(update(this.state, {
        errorMessage: {$set: ''}
      }));
      if (resp.status === 200) {
        return resp.json();
      } else {
        this.props.onExpire();
      }
    }).then(messages => {
      callback(messages);
    })
  }

  onChatClick(chat) {
    this.fetchChatHistory(chat.id, (messages => {
      this.setState(update(this.state, {
        messages: {$set: messages},
        activeChat: {$set: chat.id}
      }));
    }));
  }

  render() {
    return (
      <div>
        <div className="chat-list" style={{
          width: 300,
          float: 'left',
        }}>
          <ul>
            {this.state.chats.map((el, i) => {
              let style = {
                cursor: 'pointer'
              };

              if (el.id === this.state.activeChat) {
                style.backgroundColor = '#ccc';
              }
              return (
                <li key={i}
                    style={style}
                    onClick={this.onChatClick.bind(this, el)}>
                  {el.name}
                </li>
              )
            })}
          </ul>
        </div>
        <div className="chat-history" style={{
          float: 'left',
          width: 700
        }}>
          <ul>
            {this.state.messages.map((el, i) => {
              return (
                <li key={i}>
                  {el.datetime} {el.login}: {el.message}
                </li>
              )
            })}
          </ul>
          <input type="text" />
          <button>Отправить</button>
        </div>
      </div>
    );
  }
}


class App extends Component {
  state = {
    token: ''
  }

  componentDidMount() {
    let token = cookie.load('token');
    if (token === undefined) {
      this.setState({
        token: ''
      });
    } else {
      this.setState({
        token: token
      });
    }
  }

  onAuthorize(token) {
    let expirationDate = new Date();
    expirationDate.setFullYear(expirationDate.getFullYear() + 1);

    cookie.save('token', token, {
      expires: expirationDate
    });

    this.setState({
      token: token
    });
  }

  onExpire() {
    this.setState({
      token: ''
    });
  }

  render() {
    let body;
    if(this.state.token.length > 0) {
      body = <Chat token={this.state.token}
                   onExpire={this.onExpire.bind(this)} />;
    } else {
      body = <Authorize onAuthorize={this.onAuthorize.bind(this)} />;
    }

    return (
      <div className="App">
        <div className="App-header">
          <img src={logo} className="App-logo" alt="logo" />
          <h2>Чатики</h2>
        </div>
        <div className="content">
          {body}
        </div>
      </div>
    );
  }
}

export default App;
