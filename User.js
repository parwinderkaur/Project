'use strict'

const MentorModel = use('App/Models/Mentor');
const Env = use('Env');
const Event = use('Event');

const kue = use('Kue')
const Job = use('App/Jobs/LoginJob')
const SignupMail = use('App/Jobs/SignupMail');

const User = exports = module.exports = {}

User.registered = async (data) => {
    if(data.user_type == "MENTOR"){
        await MentorModel.create({
            user_id: data.id,
            mentor_type: data.user_category,
            mentor_cost:Env.get('APPOINTMENT_COST')
        })
    }
    if(data.user_type == "MENTEE"){
       var x=  kue.dispatch(SignupMail.key, {name: data.first_name, email: data.email});
    }
}

User.login = async (user, ip) => {
    kue.dispatch(Job.key, {user: user.toJSON(), ip});
}
