#include frex:shaders/api/header.glsl
#include lomo:shaders/lib/transform.glsl
#include lomo:shaders/lib/reflection.glsl
#include lomo:reflection_config

/* lomo:pipeline/reflection.frag */

#define LOMO_REFLECTION_TYPE 0

uniform sampler2D u_reflective;
uniform sampler2D u_input;
uniform sampler2D u_input_depth;

varying vec2 _cvv_texcoord;

void main() {
	vec4 packed_normal = texture2D(u_reflective, _cvv_texcoord);

	vec4 reflection_color = vec4(0);
	float ratio = 0;

	if(packed_normal.a != 0) {
		vec3 normal = normalize((packed_normal.xyz - 0.5) * 2);
		mat4 view = frx_viewMatrix();
		mat4 proj = frx_projectionMatrix();

		float win_s_depth = texture2D(u_input_depth, _cvv_texcoord).r ;
		vec3 win_s_position = vec3(gl_FragCoord.xy, win_s_depth);
		vec3 cam_s_position = win_to_cam(win_s_position, proj);

		mat3 rotation = mat3(view);
		vec3 cam_s_normal = normalize(rotation * normal);

		vec3 into_camera = normalize(-cam_s_position);
		float cos_between_normal_and_ray = dot(into_camera, cam_s_normal);
		vec3 reflection_dir = normalize(into_camera + (cam_s_normal*cos_between_normal_and_ray - into_camera)* 2);
		
		reflect_result res = reflect(cam_s_position, reflection_dir, u_input, u_input_depth, proj);
		reflection_color = res.color;
		ratio = res.ratio;
	}

	gl_FragData[0] = mix(texture2D(u_input, _cvv_texcoord), reflection_color, ratio);
}