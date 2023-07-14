'use strict'

const Task = use('Task')
const Mail = use('Mail');
const Appointment = use('App/Models/Appointment');
const User = use('App/Models/User')
const moment = use('moment');
const Logger = use('Logger')
const Env = use('Env');
const Database = use('Database');

class AppointmentReminder extends Task {
  static get schedule () {
    return '* * * * * *'
  }

  async handle () {
    let tenMinute=moment().add(10, 'minutes').format('HH:mm:ss');
    let oneHour=moment().add(1, 'hours').format('HH:mm:ss');
    let appointment = await Appointment.query().where({is_processed: 0, status: 'PENDING',date:moment().format('YYYY-MM-DD')})
        .where('from','>',moment().format('HH:mm:ss')).fetch();
    appointment = appointment.toJSON();
    appointment.forEach(async (appo) => {
      try{
          //master union mail
          if (appo.from === tenMinute || appo.from === oneHour){
            let remain_time=(tenMinute === appo.from)?"10 minutes":"1 hour"
            let mentee = await User.find(appo.mentee_id);
            let mentor = await User.find(appo.mentor_id);
            const joining_link=appo.room_id ? Env.get('FRONTEND_URL')+"/mentorkart?type=VideoCall&room-id="+appo.room_id :Env.get('FRONTEND_URL');
            if (mentee.org_id != Env.get('MASTER_UNION_ORG_ID')){
              await Mail.send('mails.AppointmentReminder',
                  {name: mentee.first_name+' '+mentee.last_name,joining_link:joining_link,remain_time:remain_time}, (message) => {
                    message.from(Env.get('MAIL_USER'), 'Mentorkart')
                    message.to(mentee.email)
                    message.subject('Reminder! '+remain_time+' to go for 1-on-1 Mentorship Session')
                    message.bcc([Env.get('MAIL_USER'),"nitish.toppo@mentorkart.com"])
                  })
                Logger.transport('file').info(`Ten minute and 1 hour before appo id ${appo.id} reminder mail send to mentee id ${mentee.id}`);
            }
            await Mail.send('mails.AppointmentReminder',
                {name: mentor.first_name+' '+mentor.last_name,joining_link:joining_link,remain_time:remain_time}, (message) => {
                  message.from(Env.get('MAIL_USER'), 'Mentorkart')
                  message.to(mentor.email)
                  message.subject('Reminder! '+remain_time+' to go for 1-on-1 Mentorship Session')
                  message.bcc([Env.get('MAIL_USER'),"nitish.toppo@mentorkart.com"])
                })
              Logger.transport('file').info(`Ten minute and 1 hour before appo id ${appo.id} reminder mail send to mentor id ${mentor.id}`);
          }
      }catch (e){
        Logger.transport('file').info(`Ten minute and 1 hour before reminder mail Failed ${e.toString()}`);
      }
    })
    // this.info('Task AppointmentReminder handle')
      try {
          //DISPUTED appointment status if call status is not processed
          const appointmentDis = await Appointment.query().where({
              is_processed: 0,
              status: 'PENDING'
          }).where(Database.raw(`date <= CURDATE()`))
              .where('to', '<', moment().format('HH:mm:ss')).update({'status': 'DISPUTED'});
        //complete appointment status if it is_processed
          const appoint = await Appointment.query().where({
              is_processed: 1,
              status: 'PENDING'
          }).where(Database.raw(`date <= CURDATE()`))
              .where('to', '<', moment().format('HH:mm:ss')).update({'status': 'COMPLETED'});
          if(appoint || appointmentDis) Logger.transport('file').info(`update appointment status COMPLETED = ${appoint} and DISPUTED = ${appointmentDis} at time ${moment().format('YYYY-MM-DD HH:mm:ss')}`);
      }catch (e) {
          Logger.transport('file').info(`update appointment status failed in Task AppointmentReminder handle`);
      }
  }
}

module.exports = AppointmentReminder
